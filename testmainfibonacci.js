var runs = 100;
var times = []; 

for (var i = 0; i < runs; i++) {
  var t1 = 0;
  var t2 = 1;

  var start = performance.now();

  for (var count = 0; count < 10000000; count++) {
    var test = t1 + t2;
    t1 = t2;
    t2 = test;
  }

  var end = performance.now();
  times.push(end - start); 
}

// Beräkna medelvärde
var sum = times.reduce((a, b) => a + b, 0);
var average = sum / runs;

// Beräkna standardavvikelse
var variance = times.reduce((a, b) => a + Math.pow(b - average, 2), 0) / (runs - 1);
var stdDev = Math.sqrt(variance);

// Beräkna CV (i procent)
var cv = (stdDev / average) * 100;

console.log("Average ms: " + average.toFixed(3));
console.log("Standard deviation ms: " + stdDev.toFixed(3));
console.log("CV (%): " + cv.toFixed(2));
