# Project notes for Claude

- Commit to `main` unless told otherwise.
- Live web pages go in the repository root (`/`), which GitHub Pages serves from `main` / root.
- Every time a change is applied to the live site, push it to `main` and also publish the root page (with its `css/`, `js/` and `assets/` files) to the Claude artifact preview, so the change can be viewed right away while GitHub Pages builds and deploys. Update the same artifact each time (https://claude.ai/artifact/VVpES7H69aPkkaVbZxCbeY, pass it as `url` from a new session) rather than creating a new one, and give the user its link.

## How to ask questions

- Use the AskUserQuestion tool for every question. Do not write questions as a list in the reply.
- Ask one question at a time and wait for the answer before asking the next.
- For each question, offer 2–4 suggested answers based on what is in the repository. The user can always pick "Other" to type their own.
