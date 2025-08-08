import time
from numbers import Number
import math

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
total_time = 0

for i in range(runs):
    test = 1
    start_time = time.time()

    for count in range(100000):
        test = (test if isinstance(test, Number) else 0) + 1
        if math_isPrime(test):
            # Commented out to avoid clutter
            print(test)
            pass

    elapsed = time.time() - start_time
    total_time += elapsed
    # print(f"Run {i+1}: {elapsed:.4f} seconds")

avg_time = total_time / runs
print(f"\n📊 Average time over {runs} runs: {avg_time:.4f} seconds")