#!/bin/bash
# Kill anything listening on the logbook ports (8080, 8081, 8090)

PORTS="8080 8081 8090"

for p in $PORTS; do
  sudo lsof -ti:$p | xargs -r sudo kill -9
done

echo "✅ Freed ports: $PORTS"
