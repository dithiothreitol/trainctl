import { describe, expect, it } from 'vitest'
import { easyHrCeiling, HR_CEILING_KINDS, LT1_SHARE_OF_HRMAX } from './hr-ceiling.ts'

describe('C8: pułap tętna biegu spokojnego i długiego (Z-2, N-13)', () => {
  it('LT1 osobno dla płci: 78,9% HRmax u mężczyzn, 83,6% u kobiet, w dół do pełnego uderzenia', () => {
    expect(LT1_SHARE_OF_HRMAX).toEqual({ male: 0.789, female: 0.836 })
    expect(easyHrCeiling({ sex: 'male', hrMax: { bpm: 190, measured: true } })).toEqual({ bpm: 149, share: 0.789, sex: 'male', measured: true })
    expect(easyHrCeiling({ sex: 'female', hrMax: { bpm: 190, measured: false } })).toEqual({ bpm: 158, share: 0.836, sex: 'female', measured: false })
  })

  it('bez płci albo bez HRmax pułapu nie ma (N-13: bez wspólnego progu)', () => {
    expect(easyHrCeiling({ hrMax: { bpm: 190, measured: true } })).toBeUndefined()
    expect(easyHrCeiling({ sex: 'unspecified', hrMax: { bpm: 190, measured: true } })).toBeUndefined()
    expect(easyHrCeiling({ sex: 'male' })).toBeUndefined()
  })

  it('pułap dotyczy tylko biegu spokojnego i długiego; akcenty zostają przy tempie', () => {
    expect([...HR_CEILING_KINDS].sort()).toEqual(['easy', 'long'])
  })
})
