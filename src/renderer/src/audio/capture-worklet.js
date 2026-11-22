// Runs on the sound thread. Passes the microphone's samples (one channel)
// on to the program, block by block, and plays nothing itself.
class LysarkCapture extends AudioWorkletProcessor {
  process(inputs) {
    const channel = inputs[0] && inputs[0][0];
    if (channel && channel.length > 0) this.port.postMessage(channel.slice(0));
    return true;
  }
}
registerProcessor('lysark-capture', LysarkCapture);
