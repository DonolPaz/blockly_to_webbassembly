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

test = 1
start_time = time.time()  # Start timing

for count in range(10000):
    test = (test if isinstance(test, Number) else 0) + 1
    if math_isPrime(test):
        # You can comment out the print to reduce clutter
        print(test)
        pass

end_time = time.time()  # End timing
print(f"✅ Python version took {(end_time - start_time):.4f} seconds")
