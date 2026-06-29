# Pine Script Support Matrix

## Supported Versions
- **v3, v4**: Автоматически нормализуются к v5 синтаксису (добавляются префиксы `ta.`, `study()` → `indicator()`)
- **v5**: Полная поддержка базовых индикаторов и сигналов
- **v6**: Частичная поддержка — работают индикаторы, но НЕ работают новые v6-специфичные конструкции (см. ниже)

## Supported Pine Functions

### Indicators (TA functions)
| Function | Support | Note |
|---|---|---|
| `ta.rsi()` | ✅ Full | RSI(period) → indicator node |
| `ta.sma()` | ✅ Full | SMA(period) → indicator node |
| `ta.ema()` | ✅ Full | EMA(period) → indicator node |
| `ta.wma()`, `ta.dema()`, `ta.tema()` | ✅ Full | Mapped to EMA |
| `ta.bb()` | ✅ Full | Bollinger Bands [upper, basis, lower] |
| `ta.macd()` | ✅ Full | [macdLine, signal, hist] destructuring |
| `ta.stoch()` | ✅ Full | Stochastic [k, d] |
| `ta.atr()` | ✅ Full | Average True Range |
| `ta.cci()` | ✅ Full | Commodity Channel Index |
| `ta.mfi()` | ✅ Full | Money Flow Index |
| `ta.obv()` | ✅ Full | On-Balance Volume |
| `ta.adx()` | ✅ Full | Average Directional Index |
| `ta.dmi()` | ✅ Full | Directional Movement Index |
| `ta.mom()`, `ta.roc()` | ✅ Full | Momentum / Rate of Change |
| `ta.vwap()` | ✅ Full | Volume-Weighted Avg Price |
| `ta.wpr()` | ✅ Full | Williams %R |
| `ta.vwma()`, `ta.alma()`, `ta.hma()` | ✅ Full | Mapped to EMA |
| `ta.highest()`, `ta.lowest()` | ✅ Full | High/Low lookback |
| `ta.supertrend()` | ✅ Full | Supertrend [value, direction] |
| `ta.pivothigh()`, `ta.pivotlow()` | ✅ Full | Pivot levels (v5) |

### Math Functions
| Function | Support | Note |
|---|---|---|
| `math.abs()` | ✅ Full | Absolute value — tracked in vars, transpiled to Python `abs()` |
| `math.max()` | ✅ Full | Maximum — tracked in vars, transpiled to Python `max()` |
| `math.min()` | ✅ Full | Minimum — tracked in vars, transpiled to Python `min()` |
| `math.round()` | ✅ Full | Rounding — tracked in vars, transpiled to Python `round()` |
| `math.ceil()` | ✅ Full | Ceiling — transpiled to `math.ceil()` |
| `math.floor()` | ✅ Full | Floor — transpiled to `math.floor()` |
| `math.sqrt()` | ✅ Full | Square root — transpiled to `math.sqrt()` |
| `math.pow()` | ✅ Full | Power — transpiled to `math.pow()` |
| `math.log()` | ✅ Full | Logarithm — transpiled to `math.log()` |

### Cross Functions
| Function | Support | Note |
|---|---|---|
| `ta.crossover(a, b)` | ✅ Full | Cross above node |
| `ta.crossunder(a, b)` | ✅ Full | Cross below node |
| `ta.cross()` | ✅ Full | Generic cross |

### Signal Detection
| Pattern | Support | Note |
|---|---|---|
| `strategy.entry("name", strategy.long, when=cond)` | ✅ Full | Extracts condition |
| `plotshape(condition, style=shape.*)` | ✅ Full | Detects LONG/SHORT from shape |
| `alertcondition(condition)` | ✅ Full | First arg as LONG signal |
| `if condition strategy.entry(...)` | ✅ Full | v5 if-pattern |
| Variable naming: `longCondition`, `shortEntry` | ✅ Full | Fallback pattern matching |

## NOT Supported

### V6-Specific Features
- ❌ `map.new()`, `matrix.new()` — data structures
- ❌ `array.new()` — arrays (not maps/matrices)
- ❌ `line.new()`, `label.new()`, `box.new()`, `table.new()` — drawing objects
- ❌ Object-oriented features: `type`, `method`, `import` (v5 features in v6)

### Control Flow
- ⚠️ `for i = 0 to N` — simple for-loops converted to lookback_window nodes; complex loops not supported
- ❌ `while`, `switch` loops/statements
- ❌ Multi-line `if/else` blocks (only single-line detections work)

### Multitimeframe & External Data
- ❌ `request.security(sym, tf, expr)` — partial (v5 v6) — MTF node created but not fully evaluated
- ❌ `input()`, `input.int()`, `input.float()` — extracted as constants, not as UI inputs

### Other
- ❌ `var` accumulator variables (state)
- ❌ Custom libraries and imports
- ❌ `strategy.exit()`, `strategy.close()` order management
- ✅ Math functions (math.abs, math.max, math.min, math.round, math.ceil, math.floor, math.sqrt, math.pow, math.log) — fully supported
- ❌ Volume analysis beyond `ta.sma(volume, N)`

## Unsupported ta.* Functions
If script uses one of these, it's logged as WARNING and skipped:
- `ta.valuewhen()` — historical value lookup
- `ta.barssince()` — bar counting
- `ta.cum()` — cumulative sum
- `ta.change()` — value delta
- `ta.tr()` — true range
- `ta.rising()`, `ta.falling()` — trend helpers
- And 10+ others

## Parsing Quality Levels

| Quality | Condition | Action |
|---|---|---|
| **full** | ≥90% of ta.* calls recognized | Full graph generated, ready to use |
| **partial** | 50-89% recognized | Graph generated with warnings, may need manual fixes |
| **fallback** | <50% or no indicators | Entire script → Custom Code node (manual editing needed) |

## Recommendations

✅ **Good candidates for import:**
- Simple trend-following strategies (SMA/EMA crossovers)
- RSI/MACD-based scalpers
- Bollinger Bands breakouts
- Multi-indicator confirmation patterns

❌ **Risky to import:**
- V6-specific code (maps, arrays, objects)
- Complex conditional logic with loops
- Strategies with heavy volume analysis
- Strategies using drawing objects for logic

## How to Check Compatibility Before Importing

1. Check `@version` declaration:
   - v5 and earlier: usually OK
   - v6: check if uses `map.new()`, `array.new()`, etc.

2. Search for unsupported keywords:
   - `for`, `while`, `switch` → loops not supported
   - `type`, `method`, `import` → OOP not supported
   - `line.new`, `label.new`, `box.new`, `table.new` → drawing objects

3. Use request.security() sparingly
   - MTF node created but not validated

## Import Workflow

```
User pastes Pine Script
      ↓
parseLogger captures version & unsupported constructs
      ↓
Parser tries to recognize all indicators/signals
      ↓
Quality report: full/partial/fallback
      ↓
User sees logs in UI + quality metrics
      ↓
If quality ≥50%: auto-navigate to builder
If quality <50%: fallback to Custom Code node
      ↓
User can edit nodes manually in builder
```

## Error Debugging

If import fails, check browser console and Pine Import log for:
1. **Parse failed** → Syntax error in Pine Script
2. **No indicators recognized** → Script doesn't match any patterns, landed in fallback
3. **Unsupported constructs found** → Listed in warnings (loops, types, etc.)
4. **Pine version X** → Log shows detected version; v6-specific features logged as unsupported

## Future Improvements

- [ ] Support `array.new()` with basic array operations
- [ ] Support `var` accumulator variables (state tracking)
- [ ] Support `for` loops with simple iteration patterns
- [ ] Full v6 object support (careful with OOP complexity)
- [ ] Request.security() proper multi-timeframe evaluation
