import time
import math

runs = 100
times = []

for _ in range(runs):
    t1 = 0
    t2 = 1
    
    start = time.perf_counter()
    for count in range(1000000):
        test = t1 + t2
        t1 = t2
        t2 = test
    end = time.perf_counter()
    
    elapsed = end - start
    times.append(elapsed)

# Medelvärde i ms
avg_time_ms = (sum(times) / runs) * 1000

# Standardavvikelse i ms
variance = sum((t - sum(times)/runs) ** 2 for t in times) / (runs - 1)
std_dev_ms = math.sqrt(variance) * 1000

print(f"Average Python time: {avg_time_ms:.6f} ms")
print(f"Standard deviation: {std_dev_ms:.6f} ms")