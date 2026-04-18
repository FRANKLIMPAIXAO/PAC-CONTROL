# Payload do agente desktop

## Register device
```json
{
  "user_id": "uuid",
  "hostname": "COLAB-01",
  "os": "windows",
  "agent_version": "0.1.0"
}
```

## Heartbeat
```json
{
  "device_id": "uuid",
  "is_idle": false
}
```

## Events batch
```json
{
  "device_id": "uuid",
  "user_id": "uuid",
  "events": [
    {
      "ts": "2026-04-17T14:20:00Z",
      "event_type": "activity",
      "app_name": "Microsoft Excel",
      "url_domain": null,
      "window_hash": "sha256:...",
      "is_idle": false,
      "keys_count": 10,
      "mouse_count": 4,
      "payload_json": {
        "session": "abc",
        "source": "agent-mac"
      }
    }
  ]
}
```
