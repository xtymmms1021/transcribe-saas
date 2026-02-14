import { createProvider } from "./providers/index.js";

async function main() {
  const provider = createProvider();
  const health = await provider.health();
  console.log(`[worker] provider=${provider.name} health=${JSON.stringify(health)}`);
  console.log("[worker] queue loop placeholder started");
  setInterval(() => {
    // TODO: poll queue and run jobs
  }, 10000);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
