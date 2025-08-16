function mean(arr) {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function stdDev(arr) {
  const m = mean(arr);
  return Math.sqrt(arr.reduce((sum, val) => sum + (val - m) ** 2, 0) / arr.length);
}

function mathIsPrime(n) {
  if (n == 2 || n == 3) {
    return true;
  }
  if (isNaN(n) || n <= 1 || n % 1 !== 0 || n % 2 === 0 || n % 3 === 0) {
    return false;
  }
  for (var x = 6; x <= Math.sqrt(n) + 1; x += 6) {
    if (n % (x - 1) === 0 || n % (x + 1) === 0) {
      return false;
    }
  }
  return true;
}

const times = [];

for (let run = 0; run < 100; run++) {
  let t1 = 0;
  let test = 1;

  const start = performance.now();
  for (let count = 0; count < 1000000; count++) {
    test = (typeof test === 'number' ? test : 0) + 1;
    if (mathIsPrime(test)) {
      t1 = (typeof t1 === 'number' ? t1 : 0) + 1;
    }
  }
  const end = performance.now();
  times.push(end - start);
}

const avg = mean(times);
const std = stdDev(times);
const cv = std / avg;

console.log(`Avg time (ms): ${avg}`);
console.log(`Std deviation (ms): ${std}`);
console.log(`CV: ${cv}`);
