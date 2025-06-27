EMCC = emcc
CFLAGS = -O3 --no-entry -s STANDALONE_WASM=1 -s EXPORTED_FUNCTIONS="['_my_generated_function']"

all: build/main.wasm build/main.js

build/main.js build/main.wasm: src/main.c
	mkdir -p build
	$(EMCC) $(CFLAGS) $< -o build/main.js

.PHONY: gen-c build

gen-c:
	node ../generate_c.js

build: gen-c
	cd ../llvm && emcc -O3 src/generated.c -o build/generated.js \
	    -s STANDALONE_WASM=1 -s EXPORTED_FUNCTIONS="['_generated_main']"
