function mathIsPrime(n) {
  if (n == 2 || n == 3) return true;
  if (isNaN(n) || n <= 1 || n % 1 !== 0 || n % 2 === 0 || n % 3 === 0) return false;
  for (var x = 6; x <= Math.sqrt(n) + 1; x += 6) {
    if (n % (x - 1) === 0 || n % (x + 1) === 0) return false;
  }
  return true;
}

let runs = 100;
let totalTime = 0;

for (let i = 0; i < runs; i++) {
  let test = 1;
  const t0 = performance.now();

  for (let count = 0; count < 100000; count++) {
    test = (typeof test === 'number' ? test : 0) + 1;
    if (mathIsPrime(test)) {
      // Commented to avoid clutter
      //console.log(test);
    }
  }

  const t1 = performance.now();
  const elapsed = t1 - t0;
  totalTime += elapsed;
  //console.log(`Run ${i + 1}: ${elapsed.toFixed(2)} ms`);
}

let avgTime = totalTime / runs;
console.log(`\n📊 Average time over ${runs} runs: ${avgTime.toFixed(2)} ms`);