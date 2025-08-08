async function runWasmBenchmark() {
  const response = await fetch('Sievee.wasm');
  const bytes = await response.arrayBuffer();
  const { instance } = await WebAssembly.instantiate(bytes);

  const runs = 99;
  let totalTime = 0;

  for (let i = 0; i < runs; i++) {
    const t0 = performance.now();
    const count = instance.exports.count_primes(1000000);
    const t1 = performance.now();
    totalTime += (t1 - t0);
  }

  const avgTime = totalTime / runs;
  console.log(`Antal primtal mellan 2 och 1000000: ${instance.exports.count_primes(1000000)}`);
  console.log(`📊 WASM genomsnittlig tid över ${runs} körningar: ${avgTime.toFixed(2)} ms`);
}

runWasmBenchmark().catch(console.error);