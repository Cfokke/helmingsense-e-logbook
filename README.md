## Quickstart (Dev)

```bash
git clone https://github.com/Cfokke/helmingsense-e-logbook.git
cd helmingsense-e-logbook
git checkout develop
npm install   # (no deps yet, but keeps future-proof)
npm test      # run unit tests
node app/services/snapshot/index.js   # start snapshot loop (writes ./data/signalk_snapshot.json)
