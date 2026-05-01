const { Pool } = require('pg');

const sql = `
CREATE OR REPLACE FUNCTION apollo_audit_trigger()
RETURNS trigger AS $$
DECLARE
  v_old_data jsonb;
  v_new_data jsonb;
  v_user_id text;
BEGIN
  -- Attempt to get the application user from a session variable
  BEGIN
    v_user_id := current_setting('app.current_user_id', true);
  EXCEPTION WHEN OTHERS THEN
    v_user_id := NULL;
  END;

  IF (TG_OP = 'UPDATE') THEN
    v_old_data := to_jsonb(OLD);
    v_new_data := to_jsonb(NEW);
    
    IF TG_TABLE_NAME = 'personnel' THEN
      NEW.version := OLD.version + 1;
      v_new_data := to_jsonb(NEW);
    END IF;

    IF v_old_data = v_new_data THEN
        RETURN NEW;
    END IF;

    INSERT INTO audit_logs (table_name, record_id, action, old_data, new_data, changed_by)
    VALUES (TG_TABLE_NAME::text, NEW.id::text, TG_OP, v_old_data, v_new_data, NULLIF(v_user_id, '')::uuid);
    RETURN NEW;
    
  ELSIF (TG_OP = 'DELETE') THEN
    v_old_data := to_jsonb(OLD);
    INSERT INTO audit_logs (table_name, record_id, action, old_data, changed_by)
    VALUES (TG_TABLE_NAME::text, OLD.id::text, TG_OP, v_old_data, NULLIF(v_user_id, '')::uuid);
    RETURN OLD;
    
  ELSIF (TG_OP = 'INSERT') THEN
    v_new_data := to_jsonb(NEW);
    -- FIXED: Added old_data to the column list so it matches the 6 values below
    INSERT INTO audit_logs (table_name, record_id, action, old_data, new_data, changed_by)
    VALUES (TG_TABLE_NAME::text, NEW.id::text, TG_OP, NULL, v_new_data, NULLIF(v_user_id, '')::uuid);
    RETURN NEW;
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
`;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

pool.query(sql)
  .then(() => {
    console.log("Trigger fixed successfully!");
    pool.end();
  })
  .catch(err => {
    console.error("Error fixing trigger:", err);
    pool.end();
  });
