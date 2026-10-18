import { useEffect, useRef, useState } from "react";
import {
  Check,
  ExternalLink,
  KeyRound,
  LoaderCircle,
  LogOut,
  X,
} from "lucide-react";
import {
  clearGitHubToken,
  type DeviceAuthorization,
  type GitHubUser,
  requestDeviceAuthorization,
  saveGitHubToken,
  savedGitHubToken,
  verifyOwnerToken,
  waitForDeviceAuthorization,
} from "../services/githubAuth";

export function OwnerAccess() {
  const [user, setUser] = useState<GitHubUser | null>(null);
  const [open, setOpen] = useState(false);
  const [authorization, setAuthorization] =
    useState<DeviceAuthorization | null>(null);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const token = savedGitHubToken();
    if (token) {
      void verifyOwnerToken(token)
        .then(setUser)
        .catch(() => clearGitHubToken());
    }
    return () => abortRef.current?.abort();
  }, []);

  const close = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setOpen(false);
    setAuthorization(null);
    setWorking(false);
    setError("");
  };

  const signIn = async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setWorking(true);
    setError("");
    try {
      const deviceAuthorization = await requestDeviceAuthorization();
      setAuthorization(deviceAuthorization);
      const token = await waitForDeviceAuthorization(
        deviceAuthorization,
        controller.signal,
      );
      const owner = await verifyOwnerToken(token);
      saveGitHubToken(token);
      setUser(owner);
      close();
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === "AbortError")
        return;
      setWorking(false);
      setError(
        caught instanceof Error ? caught.message : "GitHub sign-in failed.",
      );
    }
  };

  const signOut = () => {
    clearGitHubToken();
    setUser(null);
  };

  if (user) {
    return (
      <div className="owner-session">
        <span title="Owner access enabled">
          <img src={user.avatar_url} alt="" />
          <Check size={13} /> @{user.login}
        </span>
        <button onClick={signOut} aria-label="Sign out of GitHub">
          <LogOut size={15} />
        </button>
      </div>
    );
  }

  return (
    <>
      <button className="owner-button" onClick={() => setOpen(true)}>
        <KeyRound size={17} /> <span>Owner sign in</span>
      </button>
      {open && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(event) =>
            event.target === event.currentTarget && close()
          }
        >
          <section
            className="github-sign-in"
            role="dialog"
            aria-modal="true"
            aria-labelledby="github-sign-in-title"
          >
            <button className="modal-close" onClick={close} aria-label="Close">
              <X size={18} />
            </button>
            <KeyRound className="github-mark" size={32} />
            <p className="kicker">OWNER ACCESS</p>
            <h2 id="github-sign-in-title">Sign in with GitHub</h2>
            {!authorization ? (
              <>
                <p>
                  GitHub verifies your identity. Only the configured owner
                  account is accepted.
                </p>
                <button
                  className="sign-in-primary"
                  onClick={signIn}
                  disabled={working}
                >
                  {working ? (
                    <LoaderCircle className="spin" size={18} />
                  ) : (
                    <KeyRound size={18} />
                  )}
                  {working ? "Connecting…" : "Continue with GitHub"}
                </button>
              </>
            ) : (
              <>
                <p>Enter this one-time code on GitHub:</p>
                <strong className="device-code">
                  {authorization.userCode}
                </strong>
                <a
                  className="sign-in-primary"
                  href={authorization.verificationUri}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open GitHub <ExternalLink size={16} />
                </a>
                <small className="waiting-message">
                  <LoaderCircle className="spin" size={15} /> Waiting for
                  GitHub…
                </small>
              </>
            )}
            {error && (
              <p className="auth-error" role="alert">
                {error}
              </p>
            )}
          </section>
        </div>
      )}
    </>
  );
}
