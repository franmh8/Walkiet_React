// Una consulta en vuelo, pausa en segundo plano y espera progresiva si falla.
export function startChatPolling(work: () => Promise<boolean | void>, active: () => boolean, interval: number) {
  let stopped = false, running = false, again = false, failures = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const schedule = (delay: number) => {if (!stopped) timer = setTimeout(() => void run(), delay);};
  const run = async () => {
    if (stopped) return;
    if (running) {again = true; return;}
    clearTimeout(timer);
    if (!active()) {schedule(interval); return;}
    running = true;
    try {const result = await work(); failures = result === false ? Math.min(4, failures + 1) : 0;}
    catch {failures = Math.min(4, failures + 1);}
    finally {
      running = false;
      const delay = again ? 0 : Math.min(15000, interval * 2 ** failures); again = false;
      schedule(delay);
    }
  };
  void run();
  return {wake: () => void run(), stop: () => {stopped = true; clearTimeout(timer);}};
}
