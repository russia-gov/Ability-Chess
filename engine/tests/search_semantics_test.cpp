#include "../src/search_semantics.h"
#include <cassert>
using namespace abilityfish;
struct P{};
int main() {
  P p;
  auto child = [](P&, int a, int b, int d) { (void)a; (void)b; return 100 + d; };
  assert(recurse_variant(child, p, -1000, 1000, 7, {false,false}) == 107);
  assert(recurse_variant(child, p, -1000, 1000, 7, {true,true}) == -106);
}
