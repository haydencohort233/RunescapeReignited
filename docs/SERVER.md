# House server

The house server stores shared houses and likes, and gives the game the most-liked lists (Player House, Phase 5). It can also serve the game itself, so players open one address and everything works. It is one file, `server/house-server.cjs`, plain Node 18 or newer, with no packages to install.

Share codes and visiting by code work without it. The claude.ai test link has no server, so it only gets codes.

## What it stores

`houses.json` in its data folder:

- **players**: a random id per save and a hash of its secret. No names, emails or accounts.
- **houses**: one per player: its id, the name shown ("Adventurer" until the intro adds player names), the share code and when it was last updated.
- **likes**: per house, who liked it and when. "This week" counts likes from the last 7 days.

Back this file up now and then. If it ever gets corrupted, the server keeps the broken copy as `houses.json.broken-<time>` and starts empty.

## Settings

Environment variables, all optional:

| Variable | What it does | Default |
| --- | --- | --- |
| `PORT` | Port to listen on. DirectAdmin's Node.js manager sets this itself. | 8787 |
| `DATA_DIR` | Folder for `houses.json`. Put it outside the web root. | `server/data` |
| `STATIC_DIR` | The built game folder (`dist`) to serve at `/`. | not served |
| `CORS_ORIGIN` | Browser origins allowed to call the API from another site, comma separated, or `*`. | `*` |

## Running it locally

```bash
npm run server
```

Then `npm run dev` in another terminal: the dev server sends `/api` to it (vite.config.ts). The `.claude/launch.json` entry `house-server` starts it too.

## Putting it on the Advin server (DirectAdmin)

These steps assume DirectAdmin's **Setup Node.js App** page (CloudLinux / Passenger), which is what Advin's DirectAdmin usually offers. Names of buttons can differ slightly by version.

1. **Build the game on your PC:**

   ```bash
   npm run build
   ```

   This makes the `dist` folder.

2. **Upload** (File Manager or SFTP) to a folder in your home directory, for example `/home/<user>/rs-game/`:
   - `server/house-server.cjs` into `/home/<user>/rs-game/server/`
   - the contents of `dist` into `/home/<user>/rs-game/dist/`

   Make an empty folder for the data, for example `/home/<user>/rs-game-data/`. Keep it outside `public_html`.

3. **A subdomain** is simplest, for example `game.yourdomain.com`: create it in DirectAdmin first. Serving from a subfolder of your main site also works, but then build the game with `VITE_HOUSE_API` set to the full API address (see below).

4. **Setup Node.js App > Create application:**
   - Node.js version: 18 or newer (20 or 22 are good).
   - Application mode: Production.
   - Application root: `rs-game`
   - Application URL: the subdomain (or path) from step 3.
   - Application startup file: `server/house-server.cjs`
   - Environment variables:
     - `STATIC_DIR` = `/home/<user>/rs-game/dist`
     - `DATA_DIR` = `/home/<user>/rs-game-data`

   No "Run NPM Install" is needed: there are no packages.

   Don't put game files in the subdomain's own `public_html` (`domains/<subdomain>/public_html`): files there are served before the app and get in its way. Leave the `.htaccess` file that Setup Node.js App writes there.

5. **Start the app**, then open `https://game.yourdomain.com/api/health`. It should say `{"ok":true}`. Then open `https://game.yourdomain.com/` to play. The Houses panel in your house should now show the Online section.

6. **Updating the game later:** run `npm run build` again, upload the new `dist` contents over the old ones, and restart the app in DirectAdmin. Saves live in each player's browser, so nothing is lost. `houses.json` stays where it is.

Your existing website keeps running: this is a separate Node.js app on its own (sub)domain.

## If the API lives somewhere else

When the game is served from one place and the server from another (or from a subfolder), build the game with the API's full address:

```bash
VITE_HOUSE_API=https://game.yourdomain.com/api npm run build
```

On Windows PowerShell: `$env:VITE_HOUSE_API="https://game.yourdomain.com/api"; npm run build`. Set `CORS_ORIGIN` on the server to the game's address.

The claude.ai test link can't use the server: claude.ai only lets published pages talk to its own services, so it keeps share codes only.

## Limits and safety

- Requests are limited per IP: 240 reads and 30 writes a minute.
- Bodies are capped at 32 KB, share codes at 20,000 characters, house names at 24 characters (control characters and `<` `>` removed).
- A player can't like their own house. One like per player per house.
- Anyone can make a new random id, so likes can be gamed by a determined person clearing their save. Accounts (later) would fix that; for now the per-IP limits slow it down.
- The server never runs or renders codes: the game checks every code against its own content before drawing it.
