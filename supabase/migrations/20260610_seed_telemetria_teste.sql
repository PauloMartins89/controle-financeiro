-- ============================================================
-- SEED: Sessão de telemetria de teste
-- Simula uma saída a campo: parado → estrada de terra → asfalto → volta
-- Use workspace_id e user_id reais do seu ambiente.
-- ============================================================

DO $$
DECLARE
  v_workspace_id uuid;
  v_user_id      uuid;
  v_sessao_id    uuid;
  v_inicio       timestamptz := now() - interval '2 hours';
  v_lat          double precision := -19.8245;   -- ajuste para a região do cliente
  v_lng          double precision := -51.7320;
  i              int;
  v_speed        float;
  v_accel        float;
  v_ts           timestamptz;
BEGIN

  -- Pega o primeiro workspace empresa com lider_perfis ativo
  SELECT lp.workspace_id, lp.user_id
  INTO   v_workspace_id, v_user_id
  FROM   lider_perfis lp
  JOIN   workspaces   w  ON w.id = lp.workspace_id
  WHERE  lp.ativo = true
    AND  w.tipo   = 'empresa'
  ORDER  BY lp.created_at
  LIMIT  1;

  IF v_workspace_id IS NULL THEN
    RAISE EXCEPTION 'Nenhum workspace empresa com lider_perfis encontrado';
  END IF;

  -- Cria sessão
  INSERT INTO lider_telemetria_sessoes (
    workspace_id, user_id, iniciado_em, finalizado_em,
    distancia_total_m, duracao_min, pontos_count, velocidade_media_ms
  )
  VALUES (
    v_workspace_id, v_user_id, v_inicio, v_inicio + interval '45 minutes',
    4800, 45, 50, 5.2
  )
  RETURNING id INTO v_sessao_id;

  -- Gera 50 pontos simulando percurso
  FOR i IN 1..50 LOOP
    v_ts := v_inicio + (i * interval '54 seconds');

    -- Perfil de velocidade: parado → devagar → rápido → devagar → parado
    v_speed := CASE
      WHEN i < 5  THEN 0.2                        -- parado
      WHEN i < 15 THEN 1.5 + (i * 0.3)           -- lavoura / a pé
      WHEN i < 30 THEN 8.0 + (i * 0.2)           -- terra
      WHEN i < 40 THEN 18.0 + (i * 0.1)          -- asfalto
      WHEN i < 48 THEN 3.0                        -- terra devagar
      ELSE             0.1                         -- parado
    END;

    -- Acelerômetro: terra ruim tem RMS alto
    v_accel := CASE
      WHEN v_speed < 0.5 THEN 0.05
      WHEN v_speed > 16  THEN 0.15
      WHEN v_speed > 8   THEN 0.45 + (random() * 0.3)
      ELSE                    0.2  + (random() * 0.2)
    END;

    INSERT INTO lider_telemetria_pontos (
      sessao_id, workspace_id, user_id, ts,
      lat, lng, accuracy_m, speed_ms, heading, altitude_m, accel_rms
    )
    VALUES (
      v_sessao_id,
      v_workspace_id,
      v_user_id,
      v_ts,
      v_lat + (i * 0.00045) + (random() * 0.0002 - 0.0001),
      v_lng + (i * 0.00060) + (random() * 0.0002 - 0.0001),
      3.5 + random() * 2,
      v_speed,
      45.0 + (random() * 10),
      350.0 + random() * 20,
      v_accel
    );
  END LOOP;

  RAISE NOTICE 'Seed OK → sessao_id=%, workspace=%, user=%',
    v_sessao_id, v_workspace_id, v_user_id;
END $$;
