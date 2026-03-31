import { Hono } from "hono";

const app = new Hono<{ Bindings: Env }>();

// Helper to get setting value
async function getSetting(db: D1Database, key: string): Promise<string> {
  const result = await db.prepare(
    "SELECT setting_value FROM queue_settings WHERE setting_key = ?"
  ).bind(key).first<{ setting_value: string }>();
  return result?.setting_value || "0";
}

// Helper to update setting value
async function updateSetting(db: D1Database, key: string, value: string): Promise<void> {
  await db.prepare(
    "UPDATE queue_settings SET setting_value = ?, updated_at = CURRENT_TIMESTAMP WHERE setting_key = ?"
  ).bind(value, key).run();
}

// Get queue statistics
app.get("/api/queue/stats", async (c) => {
  const db = c.env.DB;
  
  // Count by stage
  const stageCounts = await db.prepare(`
    SELECT stage, priority, COUNT(*) as count 
    FROM queue_persons 
    WHERE stage != 'completed'
    GROUP BY stage, priority
  `).all<{ stage: string; priority: string; count: number }>();

  const avgWait = await db.prepare(`
    SELECT AVG((julianday(COALESCE(called_reception_at, CURRENT_TIMESTAMP)) - julianday(check_in_time)) * 24 * 60) as avg_minutes
    FROM queue_persons 
    WHERE stage IN ('reception', 'baia', 'dp') 
    AND check_in_time > datetime('now', '-1 day')
  `).first<{ avg_minutes: number }>();

  const normalServedCount = await getSetting(db, "normal_served_count");

  const stats = {
    total_waiting_reception: 0,
    total_in_baia: 0,
    total_waiting_dp: 0,
    priority_waiting: 0,
    normal_waiting: 0,
    average_wait_minutes: Math.round(avgWait?.avg_minutes || 0),
    normal_served_since_last_priority: parseInt(normalServedCount)
  };

  stageCounts.results?.forEach(row => {
    if (row.stage === 'reception') {
      stats.total_waiting_reception += row.count;
      if (row.priority === 'priority') stats.priority_waiting += row.count;
      else stats.normal_waiting += row.count;
    } else if (row.stage === 'baia') {
      stats.total_in_baia += row.count;
    } else if (row.stage === 'dp') {
      stats.total_waiting_dp += row.count;
    }
  });

  return c.json(stats);
});

// Get people waiting for reception
app.get("/api/queue/reception", async (c) => {
  const db = c.env.DB;
  
  const persons = await db.prepare(`
    SELECT * FROM queue_persons 
    WHERE stage = 'reception'
    ORDER BY 
      CASE priority WHEN 'priority' THEN 1 ELSE 2 END,
      check_in_time ASC
  `).all();

  return c.json(persons.results);
});

// Get people in baias
app.get("/api/queue/baia", async (c) => {
  const db = c.env.DB;
  
  const persons = await db.prepare(`
    SELECT * FROM queue_persons 
    WHERE stage = 'baia'
    ORDER BY assigned_baia ASC
  `).all();

  return c.json(persons.results);
});

// Get people waiting for DP
app.get("/api/queue/dp", async (c) => {
  const db = c.env.DB;
  
  const persons = await db.prepare(`
    SELECT * FROM queue_persons 
    WHERE stage = 'dp'
    ORDER BY 
      CASE priority WHEN 'priority' THEN 1 ELSE 2 END,
      called_reception_at ASC
  `).all();

  return c.json(persons.results);
});

// Get available baias
app.get("/api/queue/baias", async (c) => {
  const db = c.env.DB;
  const BAIA_COUNT = 5;
  
  const occupied = await db.prepare(`
    SELECT assigned_baia FROM queue_persons WHERE stage = 'baia'
  `).all<{ assigned_baia: number }>();

  const occupiedBaias = new Set(occupied.results?.map(r => r.assigned_baia) || []);
  const available: number[] = [];
  
  for (let i = 1; i <= BAIA_COUNT; i++) {
    if (!occupiedBaias.has(i)) available.push(i);
  }

  return c.json({ available, occupied: Array.from(occupiedBaias) });
});

// Add person to queue
app.post("/api/queue", async (c) => {
  const db = c.env.DB;
  const body = await c.req.json<{
    name: string;
    rg: string;
    is_pregnant: boolean;
    has_infant: boolean;
  }>();

  // Determine priority
  const priority = (body.is_pregnant || body.has_infant) ? 'priority' : 'normal';

  // Generate reception ticket (R001, R002, etc.)
  const counterKey = "ticket_counter_R";
  const currentCounter = parseInt(await getSetting(db, counterKey));
  const newCounter = currentCounter + 1;
  const ticketReception = `R${String(newCounter).padStart(3, '0')}`;
  
  await updateSetting(db, counterKey, String(newCounter));

  const result = await db.prepare(`
    INSERT INTO queue_persons (name, rg, is_pregnant, has_infant, priority, ticket_reception, stage, check_in_time)
    VALUES (?, ?, ?, ?, ?, ?, 'reception', CURRENT_TIMESTAMP)
  `).bind(
    body.name,
    body.rg,
    body.is_pregnant ? 1 : 0,
    body.has_infant ? 1 : 0,
    priority,
    ticketReception
  ).run();

  const person = await db.prepare(
    "SELECT * FROM queue_persons WHERE id = ?"
  ).bind(result.meta.last_row_id).first();

  return c.json(person, 201);
});

// Determine next person for reception based on priority rules
async function getNextForReception(db: D1Database) {
  const normalServedCount = parseInt(await getSetting(db, "normal_served_count"));
  
  const priorityPerson = await db.prepare(`
    SELECT * FROM queue_persons 
    WHERE stage = 'reception' AND priority = 'priority'
    ORDER BY check_in_time ASC
    LIMIT 1
  `).first();

  const normalPerson = await db.prepare(`
    SELECT * FROM queue_persons 
    WHERE stage = 'reception' AND priority = 'normal'
    ORDER BY check_in_time ASC
    LIMIT 1
  `).first();

  // If we've served 3 normals and there's a priority person waiting
  if (normalServedCount >= 3 && priorityPerson) {
    return { person: priorityPerson, resetCounter: true };
  }

  // Otherwise serve normal if available
  if (normalPerson) {
    return { person: normalPerson, resetCounter: false };
  }

  // If only priority persons remain
  if (priorityPerson) {
    return { person: priorityPerson, resetCounter: true };
  }

  return { person: null, resetCounter: false };
}

// Call next person for reception and assign to baia
app.post("/api/queue/call-reception", async (c) => {
  const db = c.env.DB;
  const body = await c.req.json<{ baia: number }>();
  
  const { person, resetCounter } = await getNextForReception(db);
  
  if (!person) {
    return c.json({ error: "Nenhuma pessoa na fila" }, 404);
  }

  // Check if baia is available
  const baiaOccupied = await db.prepare(`
    SELECT id FROM queue_persons WHERE stage = 'baia' AND assigned_baia = ?
  `).bind(body.baia).first();

  if (baiaOccupied) {
    return c.json({ error: "Baia já está ocupada" }, 400);
  }

  // Update person: move to baia stage
  await db.prepare(`
    UPDATE queue_persons 
    SET stage = 'baia', assigned_baia = ?, called_reception_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).bind(body.baia, person.id).run();

  // Update normal served counter
  if (resetCounter) {
    await updateSetting(db, "normal_served_count", "0");
  } else if (person.priority === 'normal') {
    const current = parseInt(await getSetting(db, "normal_served_count"));
    await updateSetting(db, "normal_served_count", String(current + 1));
  }

  const updatedPerson = await db.prepare(
    "SELECT * FROM queue_persons WHERE id = ?"
  ).bind(person.id).first();

  return c.json(updatedPerson);
});

// Complete baia processing, move to DP queue
app.post("/api/queue/:id/complete-baia", async (c) => {
  const db = c.env.DB;
  const id = parseInt(c.req.param("id"));

  const person = await db.prepare(
    "SELECT * FROM queue_persons WHERE id = ? AND stage = 'baia'"
  ).bind(id).first();

  if (!person) {
    return c.json({ error: "Pessoa não encontrada ou não está em baia" }, 404);
  }

  // Generate DP ticket
  const counterKey = "ticket_counter_DP";
  const currentCounter = parseInt(await getSetting(db, counterKey));
  const newCounter = currentCounter + 1;
  const ticketDp = `DP${String(newCounter).padStart(3, '0')}`;
  
  await updateSetting(db, counterKey, String(newCounter));

  // Move to DP stage
  await db.prepare(`
    UPDATE queue_persons 
    SET stage = 'dp', ticket_dp = ?, assigned_baia = NULL, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).bind(ticketDp, id).run();

  const updatedPerson = await db.prepare(
    "SELECT * FROM queue_persons WHERE id = ?"
  ).bind(id).first();

  return c.json(updatedPerson);
});

// Call next person for DP
app.post("/api/queue/call-dp", async (c) => {
  const db = c.env.DB;

  // Get next person waiting for DP (priority first, then by arrival at DP)
  const person = await db.prepare(`
    SELECT * FROM queue_persons 
    WHERE stage = 'dp'
    ORDER BY 
      CASE priority WHEN 'priority' THEN 1 ELSE 2 END,
      called_reception_at ASC
    LIMIT 1
  `).first();

  if (!person) {
    return c.json({ error: "Nenhuma pessoa aguardando DP" }, 404);
  }

  // Update to show called
  await db.prepare(`
    UPDATE queue_persons 
    SET called_dp_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).bind(person.id).run();

  const updatedPerson = await db.prepare(
    "SELECT * FROM queue_persons WHERE id = ?"
  ).bind(person.id).first();

  return c.json(updatedPerson);
});

// Mark person as completed (after DP)
app.post("/api/queue/:id/complete", async (c) => {
  const db = c.env.DB;
  const id = parseInt(c.req.param("id"));

  await db.prepare(`
    UPDATE queue_persons 
    SET stage = 'completed', completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).bind(id).run();

  return c.json({ success: true });
});

// Reset queue for new day
app.post("/api/queue/reset", async (c) => {
  const db = c.env.DB;

  // Mark all non-completed as completed
  await db.prepare(`
    UPDATE queue_persons SET stage = 'completed', completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
    WHERE stage != 'completed'
  `).run();

  // Reset counters
  await updateSetting(db, "normal_served_count", "0");
  await updateSetting(db, "ticket_counter_R", "0");
  await updateSetting(db, "ticket_counter_DP", "0");

  return c.json({ success: true });
});

// Get last called for display
app.get("/api/queue/last-called", async (c) => {
  const db = c.env.DB;

  const receptionCalled = await db.prepare(`
    SELECT *, 'reception' as called_for FROM queue_persons 
    WHERE called_reception_at IS NOT NULL AND stage = 'baia'
    ORDER BY called_reception_at DESC
    LIMIT 3
  `).all();

  const dpCalled = await db.prepare(`
    SELECT *, 'dp' as called_for FROM queue_persons 
    WHERE called_dp_at IS NOT NULL AND stage = 'dp'
    ORDER BY called_dp_at DESC
    LIMIT 3
  `).all();

  return c.json({
    reception: receptionCalled.results,
    dp: dpCalled.results
  });
});

export default app;
