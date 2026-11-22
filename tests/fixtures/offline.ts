// Tests never contact the network. This is the last line of defence: the
// program is started so that no host name outside this machine can be
// looked up at all, whatever a test happens to open (a YouTube player in the
// preview, for example). Where a test needs an answer from the web, it
// supplies the answer itself.
export const OFFLINE =
  '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1, EXCLUDE localhost';
