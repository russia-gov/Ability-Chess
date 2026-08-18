#!/usr/bin/env python3
from pathlib import Path
import sys

root = Path(sys.argv[1] if len(sys.argv) > 1 else 'vendor/Fairy-Wasm')
src = root / 'src'

# 1) Root build system: do not inject pthread support for the portable browser build.
p = src / 'Makefile'
s = p.read_text()
old = '''### On mingw use Windows threads, otherwise POSIX
ifneq ($(comp),mingw)
	CXXFLAGS += -DUSE_PTHREADS
	# On Android Bionic's C library comes with its own pthread implementation bundled in
	ifneq ($(OS),Android)
		# Haiku has pthreads in its libroot, so only link it in on other platforms
		ifneq ($(KERNEL),Haiku)
			ifneq ($(COMP),ndk)
				LDFLAGS += -lpthread
			endif
		endif
	endif
endif
'''
new = '''### On mingw use Windows threads, otherwise POSIX.
### AbilityFish browser analysis already runs inside a Web Worker, so its
### portable build deliberately uses one synchronous engine thread.
ifeq ($(ABILITYFISH_SINGLE_THREAD),yes)
	CXXFLAGS += -DABILITYFISH_SINGLE_THREAD
else ifneq ($(comp),mingw)
	CXXFLAGS += -DUSE_PTHREADS
	# On Android Bionic's C library comes with its own pthread implementation bundled in
	ifneq ($(OS),Android)
		# Haiku has pthreads in its libroot, so only link it in on other platforms
		ifneq ($(KERNEL),Haiku)
			ifneq ($(COMP),ndk)
				LDFLAGS += -lpthread
			endif
		endif
	endif
endif
'''
if old not in s:
    raise SystemExit('root Makefile pthread block changed')
s = s.replace(old, new, 1)
p.write_text(s)

# 2) Thread object: remove the native thread/mutex/cv machinery in portable mode.
p = src / 'thread.h'
s = p.read_text()
s = s.replace('''  std::mutex mutex;
  std::condition_variable cv;
  size_t idx;
  bool exit = false, searching = true; // Set before starting std::thread
  NativeThread stdThread;
''', '''#ifndef ABILITYFISH_SINGLE_THREAD
  std::mutex mutex;
  std::condition_variable cv;
#endif
  size_t idx;
  bool exit = false, searching = true; // Set before starting std::thread
#ifndef ABILITYFISH_SINGLE_THREAD
  NativeThread stdThread;
#endif
''', 1)
if '#ifndef ABILITYFISH_SINGLE_THREAD\n  NativeThread stdThread;' not in s:
    raise SystemExit('thread.h native-thread anchor changed')
p.write_text(s)

# 3) Thread lifecycle and search dispatch: execute the sole main search inline.
p = src / 'thread.cpp'
s = p.read_text()
old_ctor = '''Thread::Thread(size_t n) : idx(n), stdThread(&Thread::idle_loop, this) {

  wait_for_search_finished();
}
'''
new_ctor = '''#ifdef ABILITYFISH_SINGLE_THREAD
Thread::Thread(size_t n) : idx(n) {
  searching = false;
}
#else
Thread::Thread(size_t n) : idx(n), stdThread(&Thread::idle_loop, this) {

  wait_for_search_finished();
}
#endif
'''
s = s.replace(old_ctor, new_ctor, 1)
old_dtor = '''Thread::~Thread() {

  assert(!searching);

  exit = true;
  start_searching();
  stdThread.join();
}
'''
new_dtor = '''Thread::~Thread() {

  assert(!searching);
#ifndef ABILITYFISH_SINGLE_THREAD
  exit = true;
  start_searching();
  stdThread.join();
#endif
}
'''
s = s.replace(old_dtor, new_dtor, 1)
old_start = '''void Thread::start_searching() {

  std::lock_guard<std::mutex> lk(mutex);
  searching = true;
  cv.notify_one(); // Wake up the thread in idle_loop()
}
'''
new_start = '''void Thread::start_searching() {
#ifdef ABILITYFISH_SINGLE_THREAD
  searching = true;
  search();
  searching = false;
#else
  std::lock_guard<std::mutex> lk(mutex);
  searching = true;
  cv.notify_one(); // Wake up the thread in idle_loop()
#endif
}
'''
s = s.replace(old_start, new_start, 1)
old_wait = '''void Thread::wait_for_search_finished() {

  std::unique_lock<std::mutex> lk(mutex);
  cv.wait(lk, [&]{ return !searching; });
}
'''
new_wait = '''void Thread::wait_for_search_finished() {
#ifndef ABILITYFISH_SINGLE_THREAD
  std::unique_lock<std::mutex> lk(mutex);
  cv.wait(lk, [&]{ return !searching; });
#endif
}
'''
s = s.replace(old_wait, new_wait, 1)
old_idle_head = '''void Thread::idle_loop() {

  // If OS already scheduled us on a different group than 0 then don't overwrite
'''
new_idle_head = '''void Thread::idle_loop() {
#ifdef ABILITYFISH_SINGLE_THREAD
  return;
#else

  // If OS already scheduled us on a different group than 0 then don't overwrite
'''
s = s.replace(old_idle_head, new_idle_head, 1)
old_idle_tail = '''      search();
  }
}

/// ThreadPool::set() creates/destroys threads to match the requested number.
'''
new_idle_tail = '''      search();
  }
#endif
}

/// ThreadPool::set() creates/destroys threads to match the requested number.
'''
s = s.replace(old_idle_tail, new_idle_tail, 1)
old_set = '''void ThreadPool::set(size_t requested) {

  if (size() > 0)   // destroy any existing thread(s)
'''
new_set = '''void ThreadPool::set(size_t requested) {
#ifdef ABILITYFISH_SINGLE_THREAD
  requested = requested ? 1 : 0;
#endif

  if (size() > 0)   // destroy any existing thread(s)
'''
s = s.replace(old_set, new_set, 1)
old_dispatch = '''  main()->start_searching();
}

Thread* ThreadPool::get_best_thread() const {
'''
new_dispatch = '''#ifdef ABILITYFISH_SINGLE_THREAD
  // The whole Emscripten engine is already hosted in a browser Web Worker.
  // Run its sole search inline so no SharedArrayBuffer/pthread is required.
  main()->search();
#else
  main()->start_searching();
#endif
}

Thread* ThreadPool::get_best_thread() const {
'''
s = s.replace(old_dispatch, new_dispatch, 1)
for marker in ['#ifdef ABILITYFISH_SINGLE_THREAD\nThread::Thread', 'requested = requested ? 1 : 0;', 'main()->search();']:
    if marker not in s:
        raise SystemExit(f'thread.cpp portable marker missing: {marker}')
p.write_text(s)

# 4) Emscripten linker: remove its pthread/proxy settings and worker artifact.
p = src / 'emscripten' / 'Makefile'
s = p.read_text()
s = s.replace('\n\t-s USE_PTHREADS=1 \\\n\t-s PROXY_TO_PTHREAD=1 \\\n', '\n')
s = s.replace('stockfish.js stockfish.wasm stockfish.worker.js \\\n', 'stockfish.js stockfish.wasm \\\n')
s = s.replace('cp -f ../AUTHORS ../Copying.txt stockfish.js stockfish.wasm emscripten/public\n\tcat stockfish.worker.js emscripten/worker-postamble.js > emscripten/public/stockfish.worker.js',
              'cp -f ../AUTHORS ../Copying.txt stockfish.js stockfish.wasm emscripten/public')
if 'USE_PTHREADS=1' in s or 'PROXY_TO_PTHREAD=1' in s:
    raise SystemExit('Emscripten pthread flags still present')
p.write_text(s)

# 5) JS API: the engine now lives in the same outer Web Worker as its command
# queue, so postMessage can enqueue directly. No PThread global is needed.
p = src / 'emscripten' / 'preamble.js'
p.write_text(r'''// Portable single-thread AbilityFish Emscripten preamble.
class Queue {
  constructor() {
    this.getter = null;
    this.list = [];
  }
  async get() {
    if (this.list.length > 0) return this.list.shift();
    return await new Promise((resolve) => (this.getter = resolve));
  }
  put(x) {
    if (this.getter) {
      this.getter(x);
      this.getter = null;
      return;
    }
    this.list.push(x);
  }
}

Module["queue"] = new Queue();
Module["onCustomMessage"] = (data) => Module["queue"].put(data);
Module["postCustomMessage"] = (data) => Module["queue"].put(data);
Module["postMessage"] = Module["postCustomMessage"];

const listeners = [];
Module["addMessageListener"] = (listener) => listeners.push(listener);
Module["removeMessageListener"] = (listener) => {
  const i = listeners.indexOf(listener);
  if (i >= 0) listeners.splice(i, 1);
};
Module["print"] = Module["printErr"] = (data) => {
  if (listeners.length === 0) console.log(data);
  else for (let listener of listeners) listener(data);
};
Module["terminate"] = () => {};
''')

print('Applied portable single-thread Fairy WASM adaptation')
