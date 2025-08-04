var test;
const t0 = performance.now(); // Start timing

function mathIsPrime(n) {
  if (n == 2 || n == 3) return true;
  if (isNaN(n) || n <= 1 || n % 1 !== 0 || n % 2 === 0 || n % 3 === 0) return false;
  for (var x = 6; x <= Math.sqrt(n) + 1; x += 6) {
    if (n % (x - 1) === 0 || n % (x + 1) === 0) return false;
  }
  return true;
}

test = 1;
for (var count = 0; count < 10000; count++) {
  test = (typeof test === 'number' ? test : 0) + 1;
  if (mathIsPrime(test)) {
    // Comment out alert to avoid 1000+ popups
    console.log(test);
  }
}

const t1 = performance.now(); // End timing
console.log(`✅ JS version took ${(t1 - t0).toFixed(2)} ms`);