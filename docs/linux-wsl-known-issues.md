# Linux/WSL bekannte Probleme (Auth/Web Build)

Diese Punkte wurden in der aktuellen Umgebung (Linux/WSL-ähnlicher Container) beobachtet.

## 1) Angular SSR: Hostname-Blockierung bei `serve`

Beim Aufruf der SSR-Dev-Server-URL über `localhost`, `127.0.0.1` oder Container-IP kann ein `400 Bad Request` auftreten:

- `URL with hostname "localhost" is not allowed.`
- `URL with hostname "127.0.0.1" is not allowed.`

Ursache: Angular SSR Hostname-Allowlist/SSRF-Schutz.

## 2) Firebase Remote Config während Prerender

Beim `pnpm nx build web` können in Linux/WSL unhandled-Rejection-Logs auftauchen:

- `TypeError: Cannot read properties of null (reading 'settings')`
- Ursprung: `@firebase/remote-config` während SSR/Prerender-Initialisierung.

Der Build kann dabei trotzdem erfolgreich abschließen, sollte aber serverseitig robuster abgesichert werden (Remote Config nur im Browser initialisieren oder SSR-Guard verwenden).

## 3) Node-Version/Engine-Warnung

`pnpm` meldet im Workspace:

- `Unsupported engine: wanted: {"node":">=24"} (current: v22.x)`

Empfehlung: Node >= 24 in WSL/Linux nutzen, um inkonsistente Tooling-Effekte zu vermeiden.
