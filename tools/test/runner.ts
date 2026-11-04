import { VitestTestRunner, type VitestRunner } from 'vitest/runners'

/** Synchroniczne operacje CLI nie mogą zagłodzić potwierdzeń wyników przez IPC. */
export default class AcknowledgedTestRunner extends VitestTestRunner {
  // Vitest podłącza transport do tego publicznego hooka po utworzeniu runnera.
  declare onTaskUpdate: NonNullable<VitestRunner['onTaskUpdate']>

  async onBeforeTryTask(test: Parameters<VitestTestRunner['onBeforeTryTask']>[0]): Promise<void> {
    super.onBeforeTryTask(test)
    // Pusta aktualizacja niczego nie zalicza. Oczekiwanie na jej odpowiedź
    // pozwala odebrać wyniki przed następną blokującą operacją plikową/procesem.
    // Zachowujemy domyślne limity, błędy transportu i standardową obsługę testu.
    await this.onTaskUpdate([], [])
  }
}
