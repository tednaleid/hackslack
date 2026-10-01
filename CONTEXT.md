# hackslack

Restyling the Slack desktop app on macOS with CSS that Ted owns, without modifying Slack.app, and letting a Claude agent inspect the live Slack UI to work out what to restyle.

## Language

**Slack app**:
The installed Slack desktop application (`/Applications/Slack.app`), which is never modified.
_Avoid_: Slack client, Slack.app bundle

**Tab rail**:
The vertical strip of large icon buttons (Slackbot, Home, DMs, Activity, Later, More) between the workspace switcher and the sidebar.
_Avoid_: left nav, icon bar

**Slackbot button**:
The Slackbot entry at the top of the **Tab rail**, and the first thing hackslack hides. Only some workspaces have one.
_Avoid_: Slackbot icon, Slackbot DM, Slackbot AI button (a separate sparkle button in the top bar next to search)

**Slack page**:
One web page loaded inside the **Slack app** that shows the Slack UI. The **Stylesheets** must be applied to every Slack page, including after it reloads.
_Avoid_: window, tab, target, webview

**Stylesheet**:
One CSS file in the repo's `styles/` directory, covering one concern. All Stylesheets are combined in filename order and applied to the **Slack app**.
_Avoid_: theme, custom.css

**Launcher**:
The thing Ted uses to start Slack in place of opening the **Slack app** directly. It is what makes the **Stylesheets** apply.
_Avoid_: supervisor, daemon

**Normal mode**:
Slack running with the **Stylesheets** applied and no way for other local processes to control it.

**Inspect mode**:
Slack running with the **Stylesheets** applied and a debugging endpoint open, so that Ted or an agent can examine and experiment with the live UI. Used only while working on **Stylesheets**.
_Avoid_: debug mode, dev mode

## Relationships

- The **Launcher** starts the **Slack app** in either **Normal mode** or **Inspect mode**; switching between them restarts Slack
- The **Slack app** shows one **Slack page** for all workspaces; switching workspaces changes that page's URL and does not create a new page
- Each **Stylesheet** hides or restyles parts of the UI, such as the **Slackbot button** in the **Tab rail**
