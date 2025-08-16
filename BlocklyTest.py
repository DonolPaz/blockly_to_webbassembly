import time
from numbers import Number
import math
import statistics  # för enkel standardavvikelse

def math_isPrime(n):
    if not isinstance(n, Number):
        try:
            n = float(n)
        except:
            return False
    if n == 2 or n == 3:
        return True
    if n <= 1 or n % 1 != 0 or n % 2 == 0 or n % 3 == 0:
        return False
    for x in range(6, int(math.sqrt(n)) + 2, 6):
        if n % (x - 1) == 0 or n % (x + 1) == 0:
            return False
    return True

runs = 100
times = []

for i in range(runs):
    test = 1
    testprimes = 0
    start_time = time.time()

    for count in range(100000):
        test = (test if isinstance(test, Number) else 0) + 1
        if math_isPrime(test):
            testprimes = testprimes + 1
            pass

    elapsed = time.time() - start_time
    times.append(elapsed)

avg_time = sum(times) / runs
std_dev = statistics.stdev(times)  # sample standard deviation
cv_percent = (std_dev / avg_time) * 100

print(f"\n📊 Average time over {runs} runs: {avg_time:.6f} seconds")
print(f"📉 Standard deviation: {std_dev:.6f} seconds")
print(f"📈 CV (%): {cv_percent:.2f}")