import { type FormEvent, useEffect, useRef, useState } from "react";
import {
  Check,
  ExternalLink,
  KeyRound,
  LoaderCircle,
  LogOut,
  X,
} from "lucide-react";
import {
  type GitHubUser,
  signInOwner,
  savedOwnerToken,
  signOutOwner,
} from "../services/githubAuth";
import { closeOnBackdrop, useDialogDismiss } from "../hooks/useDialogDismiss";

export function OwnerAccess({
  onSessionChange,
}: {
  onSessionChange: (user: GitHubUser | null) => void;
}) {
  const [user, setUser] = useState<GitHubUser | null>(null);
  const [open, setOpen] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const abortRef = useRef<AbortController | null>(null);
  const tokenInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const token = savedOwnerToken();
    if (token) {
      void signInOwner(token)
        .then((owner) => {
          setUser(owner);
          onSessionChange(owner);
        })
        .catch(() => signOutOwner());
    }
    return () => abortRef.current?.abort();
  }, []);

  const close = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setOpen(false);
    setWorking(false);
    setError("");
  };

  useDialogDismiss(open, close);

  const signIn = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setWorking(true);
    setError("");
    try {
      const owner = await signInOwner(
        tokenInputRef.current?.value ?? "",
        controller.signal,
      );
      if (tokenInputRef.current) tokenInputRef.current.value = "";
      setUser(owner);
      onSessionChange(owner);
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
    signOutOwner();
    setUser(null);
    onSessionChange(null);
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
          onMouseDown={(event) => closeOnBackdrop(event, close)}
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
            <h2 id="github-sign-in-title">Owner sign in</h2>
            <p>
              Enter a fine-grained GitHub token for this repository. It stays in
              this tab's session and is erased when you sign out or close the
              tab.
            </p>
            <form
              className="owner-token-form"
              onSubmit={signIn}
              autoComplete="off"
            >
              <label htmlFor="owner-github-token">Fine-grained token</label>
              <input
                ref={tokenInputRef}
                id="owner-github-token"
                name="owner-github-token"
                type="password"
                autoComplete="new-password"
                spellCheck={false}
                placeholder="github_pat_…"
                disabled={working}
                autoFocus
              />
              <small>
                The token must select only this cookbook repository and have
                Contents read and write permission.
              </small>
              <button
                type="submit"
                className="sign-in-primary"
                disabled={working}
              >
                {working ? (
                  <LoaderCircle className="spin" size={18} />
                ) : (
                  <KeyRound size={18} />
                )}
                {working ? "Verifying…" : "Unlock owner access"}
              </button>
            </form>
            <a
              className="token-help-link"
              href="https://github.com/settings/personal-access-tokens/new"
              target="_blank"
              rel="noreferrer"
            >
              Create a token on GitHub <ExternalLink size={13} />
            </a>
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
