function isPrime(n) {
  if (n === 2 || n === 3) return true;
  if (n <= 1 || n % 2 === 0 || n % 3 === 0) return false;

  const limit = Math.floor(Math.sqrt(n)) + 1;
  for (let i = 6; i <= limit; i += 6) {
    if (n % (i - 1) === 0 || n % (i + 1) === 0) return false;
  }
  return true;
}

async function runJsBenchmark() {
  const runs = 100;
  let totalTime = 0;
  let lastCount = 0;

  for (let run = 0; run < runs; run++) {
    const t0 = performance.now();

    let count = 0;
    for (let num = 2; num <= 1000000; num++) {
      if (isPrime(num)) count++;
    }
    lastCount = count;

    const t1 = performance.now();
    totalTime += (t1 - t0);
  }

  const avgTime = totalTime / runs;
  console.log(`Antal primtal mellan 2 och 1000000: ${lastCount}`);
  console.log(`📊 JS genomsnittlig tid över ${runs} körningar: ${avgTime.toFixed(2)} ms`);
}

runJsBenchmark();