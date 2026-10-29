#include "params.h"
typedef unsigned int u32;
static float cx[NC], cy[NC], cdir[NC], cv[NC], csense[NC], cdiet[NC], csize[NC];
static float fx[NF], fy[NF], fe[NF];
static unsigned char fmeat[NF];
static float W1[NC][NHMAX * NIN], W2[NC][NOUT * (NHMAX + 1)];
static float inp[NIN], hid[NHMAX], out[NOUT];
static int cellStartF[GC * GR + 1], cellItemsF[NF], cellStartC[GC * GR + 1], cellItemsC[NC], tmpCount[GC * GR];
static u32 rs = 12345;
static float rnd(void) { rs ^= rs << 13; rs ^= rs >> 17; rs ^= rs << 5; return (rs & 0xffffff) / 16777216.0f; }
static float ftanh(float x) { if (x > 4.97f) return 1.f; if (x < -4.97f) return -1.f; float x2 = x * x; return x * (27.f + x2) / (27.f + 9.f * x2); }
static float fsq(float x) { return __builtin_sqrtf(x); }
static float fcos(float x) { while (x > 3.14159265f) x -= 6.2831853f; while (x < -3.14159265f) x += 6.2831853f; float x2 = x * x; return 1.f - x2 / 2.f + x2 * x2 / 24.f - x2 * x2 * x2 / 720.f; }
static float fsin(float x) { return fcos(x - 1.5707963f); }
static int cellOf(float x, float y) { int c = (int)(x / CELL), r = (int)(y / CELL); if (c < 0) c = 0; if (c >= GC) c = GC - 1; if (r < 0) r = 0; if (r >= GR) r = GR - 1; return r * GC + c; }
static void buildGrid(int n, float *xs, float *ys, int *start, int *items) {
  for (int i = 0; i < GC * GR; i++) tmpCount[i] = 0;
  for (int i = 0; i < n; i++) tmpCount[cellOf(xs[i], ys[i])]++;
  start[0] = 0; for (int i = 0; i < GC * GR; i++) start[i + 1] = start[i] + tmpCount[i];
  for (int i = 0; i < GC * GR; i++) tmpCount[i] = start[i];
  for (int i = 0; i < n; i++) items[tmpCount[cellOf(xs[i], ys[i])]++] = i;
}
void init(void) {
  for (int i = 0; i < NC; i++) { cx[i] = rnd() * WW; cy[i] = rnd() * WH; cdir[i] = rnd() * 6.28f; cv[i] = 0; csense[i] = 150 + rnd() * 90; cdiet[i] = rnd() < 0.15f ? 0.8f : 0.1f; csize[i] = 5 + rnd() * 6;
    for (int k = 0; k < NHMAX * NIN; k++) W1[i][k] = (rnd() - 0.5f); for (int k = 0; k < NOUT * (NHMAX + 1); k++) W2[i][k] = (rnd() - 0.5f) * 1.2f; }
  for (int i = 0; i < NF; i++) { fx[i] = rnd() * WW; fy[i] = rnd() * WH; fe[i] = 20; fmeat[i] = rnd() < 0.05f; }
}
float step(void) {
  buildGrid(NF, fx, fy, cellStartF, cellItemsF);
  buildGrid(NC, cx, cy, cellStartC, cellItemsC);
  float check = 0;
  for (int i = 0; i < NC; i++) {
    float x = cx[i], y = cy[i], sr = csense[i], pe = 1 - cdiet[i], me = cdiet[i];
    int c0 = (int)((x - sr) / CELL), c1 = (int)((x + sr) / CELL), r0 = (int)((y - sr) / CELL), r1 = (int)((y + sr) / CELL);
    if (c0 < 0) c0 = 0; if (r0 < 0) r0 = 0; if (c1 > GC - 1) c1 = GC - 1; if (r1 > GR - 1) r1 = GR - 1;
    int bf = -1; float bs = 0, bd = 0;
    for (int r = r0; r <= r1; r++) for (int c = c0; c <= c1; c++) { int cell = r * GC + c;
      for (int k = cellStartF[cell]; k < cellStartF[cell + 1]; k++) { int f = cellItemsF[k]; if (fe[f] <= 0) continue;
        float dx = fx[f] - x, dy = fy[f] - y, d2 = dx * dx + dy * dy; if (d2 > sr * sr) continue;
        float d = fsq(d2), s = (fmeat[f] ? me : pe) * (1 - d / sr); if (s > bs) { bs = s; bf = f; bd = d; } } }
    int bo = -1; float od = 1e9f;
    for (int r = r0; r <= r1; r++) for (int c = c0; c <= c1; c++) { int cell = r * GC + c;
      for (int k = cellStartC[cell]; k < cellStartC[cell + 1]; k++) { int o = cellItemsC[k]; if (o == i) continue;
        float dx = cx[o] - x, dy = cy[o] - y, d = fsq(dx * dx + dy * dy); if (d < od && d <= sr) { od = d; bo = o; } } }
    for (int k = 0; k < NIN; k++) inp[k] = 0;
    inp[0] = 1;
    if (bf >= 0) { float a = cdir[i]; inp[1] = fsin(a) * 0.5f + (fx[bf] - x) / sr; inp[2] = fcos(a) * 0.5f + (fy[bf] - y) / sr; inp[3] = 1 - bd / sr; }
    if (bo >= 0) { inp[4] = (cx[bo] - x) / sr; inp[5] = (cy[bo] - y) / sr; inp[6] = 1 - od / sr; inp[7] = csize[bo] / csize[i] - 1; inp[8] = cdiet[bo]; }
    for (int k = 11; k < 41; k++) inp[k] = ((k * 7 + i) % 5) * 0.2f;
    inp[61] = fsin(cdir[i]); inp[62] = fcos(cdir[i]);
    int nz[NIN], nn = 0; for (int k = 0; k < NIN; k++) if (inp[k] != 0) nz[nn++] = k;
    float *w = W1[i];
    for (int h = 0; h < NH; h++) { float s = 0; const float *wr = w + h * NIN; for (int j = 0; j < nn; j++) s += inp[nz[j]] * wr[nz[j]]; hid[h] = ftanh(s); }
    float *wo = W2[i];
    for (int o = 0; o < NOUT; o++) { const float *wr = wo + o * (NHMAX + 1); float s = wr[NHMAX]; for (int h = 0; h < NH; h++) s += hid[h] * wr[h]; out[o] = ftanh(s); }
    cdir[i] += out[0] * 0.2f; cv[i] += ((out[1] + 1) * 0.75f - cv[i]) * 0.2f;
    float nx = x + fcos(cdir[i]) * cv[i], ny = y + fsin(cdir[i]) * cv[i];
    if (nx < 5) nx = 5; if (nx > WW - 5) nx = WW - 5; if (ny < 5) ny = 5; if (ny > WH - 5) ny = WH - 5;
    cx[i] = nx; cy[i] = ny; check += out[2];
  }
  return check;
}
