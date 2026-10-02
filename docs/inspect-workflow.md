# Changing how Slack looks

How to find an element in Slack's UI and write a Stylesheet that hides or restyles it.

## 1. Enter Inspect mode

Ask Ted first: this restarts Slack.

```bash
just inspect
just attach
```

`just status` now starts with a WARNING, because any local process can control Slack while the debugging port is open. Keep the session short.

## 2. Find the element

Prefer small, targeted queries over `playwright-cli snapshot`, which captures the whole UI including message text. Do not copy message content into files, commits or replies. `just attach` itself saves a full page snapshot under `.playwright-cli/`; `just detach` deletes that directory, because the repo syncs through Dropbox.

List the `data-qa` attributes and labels in a region, for example the Tab rail:

```bash
playwright-cli eval "JSON.stringify([...document.querySelectorAll('[data-qa=\"tabs_full_width_class\"] button')].map(e => [e.getAttribute('data-qa'), e.getAttribute('aria-label')]))"
```

Walk up from an element to find the container that also holds its label:

```bash
playwright-cli eval "(() => { const out = []; for (let e = document.querySelector('[data-qa=\"tab_rail_home_button\"]'), n = 0; e && n < 5; e = e.parentElement, n++) out.push([e.tagName, e.getAttribute('data-qa'), String(e.className).slice(0, 60)]); return JSON.stringify(out); })()"
```

Some elements exist only in some workspaces. To switch workspace, click the nth `[data-qa="team_sidebar_item"]`:

```bash
playwright-cli eval "document.querySelectorAll('[data-qa=\"team_sidebar_item\"]')[4].click()"
```

All workspaces share one Slack page; switching changes its URL and does not reload the Stylesheets.

## 3. Choose a selector

- Prefer `data-qa` attributes. They are Slack's test hooks and change less often than class names.
- Avoid hashed class names such as `button__zEiFQ`; they change between Slack releases.
- When no nearby element has a `data-qa` attribute, match the stable prefix of a hashed class name and anchor it with `:has()` on a `data-qa` element, so a renamed class only stops the rule from matching:
  `[class*="sparkleWrapper"]:has([data-qa="slackbot-ai-button"])`.
- If hiding an element leaves an empty gap, its wrapper probably has a fixed width; hide the wrapper instead.
- To hide an element together with its label, hide the nearest container with a `data-qa` attribute, using `:has()`:
  `[data-qa="draggable_tab_item"]:has([data-qa="tab_rail_slackbot_button"])`.
- Always add `!important` to `display: none`.

## 4. Write the Stylesheet

Put each concern in its own file under `styles/`, starting with two `ABOUTME:` lines in a CSS comment. Files are combined in filename order. The Launcher applies a saved file within about a second, with no restart.

Check that the rule took effect with DOM queries:

```bash
playwright-cli eval "document.querySelector('[data-qa=\"tab_rail_slackbot_button\"]').checkVisibility()"
playwright-cli eval "JSON.stringify(document.querySelector('[data-qa=\"tab_rail_home_button\"]').getBoundingClientRect())"
```

`checkVisibility()` should be `false` for a hidden element. Compare bounding rects of neighbouring elements before and after to confirm nothing else moved, and use `document.elementFromPoint(x, y)` to check what now occupies the old position.

Screenshots are a weak check: they are scaled relative to page coordinates (about 1.5x on Ted's display), so crops computed from bounding rects land in the wrong place. If you take one, pass an explicit path such as `--filename=.playwright-cli/check.png`; a bare filename is written to the repo root. Ask Ted to confirm the visual result instead of relying on a screenshot.

## 5. Leave Inspect mode

```bash
just detach
just start
just status
```

`just status` must show no WARNING. Then commit the new or changed file in `styles/`.
