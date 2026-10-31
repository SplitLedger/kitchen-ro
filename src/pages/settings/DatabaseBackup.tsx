import { AlertDialog, Button, Flex, Heading, Text } from "@radix-ui/themes";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  installDatabaseBackup,
  pickTauriBackup,
  readChosenBackup,
  saveDatabaseBackup,
  takeRestoreError,
} from "@/db/backup";
import { isTauriRuntime } from "@/db/runtime";

export function DatabaseBackup() {
  const tauri = isTauriRuntime();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<Uint8Array | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const message = takeRestoreError();
    if (message) {
      toast.error(message);
    }
  }, []);

  async function save() {
    setBusy(true);
    try {
      const result = await saveDatabaseBackup();
      if (result === "saved") {
        toast.success(tauri ? "Saved the backup." : "Downloaded the backup.");
      }
    } catch (caught) {
      toast.error(backupMessage(caught, "Could not save the backup."));
    } finally {
      setBusy(false);
    }
  }

  async function chooseBrowserFile(file: File | undefined) {
    if (!file) {
      return;
    }
    setBusy(true);
    try {
      setPending(await readChosenBackup(file));
    } catch (caught) {
      toast.error(backupMessage(caught, "Could not restore that backup."));
    } finally {
      setBusy(false);
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    }
  }

  async function chooseTauriFile() {
    setBusy(true);
    try {
      const bytes = await pickTauriBackup();
      if (bytes) {
        setPending(bytes);
      }
    } catch (caught) {
      toast.error(backupMessage(caught, "Could not restore that backup."));
    } finally {
      setBusy(false);
    }
  }

  async function restore() {
    if (!pending) {
      return;
    }
    const bytes = pending;
    setBusy(true);
    try {
      await installDatabaseBackup(bytes);
    } catch (caught) {
      toast.error(backupMessage(caught, "Could not restore that backup."));
      setBusy(false);
    }
  }

  return (
    <Flex direction="column" gap="3">
      <Flex direction="column" gap="2">
        <Heading as="h2" size="4">
          Backup
        </Heading>
        <Text as="p" color="gray">
          The database is one SQLite file. Save a copy, or replace it with a backup you saved
          earlier. Restoring reloads the app.
        </Text>
      </Flex>
      <Flex gap="3" wrap="wrap">
        <Button
          type="button"
          loading={busy}
          onClick={() => {
            void save();
          }}
        >
          {tauri ? "Save backup" : "Download backup"}
        </Button>
        {tauri ? (
          <Button
            type="button"
            variant="soft"
            loading={busy}
            disabled={busy}
            onClick={() => {
              void chooseTauriFile();
            }}
          >
            Restore backup
          </Button>
        ) : (
          <Button
            type="button"
            variant="soft"
            loading={busy}
            disabled={busy}
            onClick={() => {
              inputRef.current?.click();
            }}
          >
            Restore backup
          </Button>
        )}
      </Flex>
      {tauri ? null : (
        <input
          ref={inputRef}
          type="file"
          accept=".db,.sqlite,application/vnd.sqlite3,application/x-sqlite3"
          aria-label="Choose a Kitchen RO backup"
          style={{ display: "none" }}
          onChange={(event) => {
            void chooseBrowserFile(event.target.files?.[0]);
          }}
        />
      )}
      <AlertDialog.Root
        open={pending !== null}
        onOpenChange={(open) => {
          if (!open && !busy) {
            setPending(null);
          }
        }}
      >
        <AlertDialog.Content maxWidth="28rem">
          <AlertDialog.Title>Replace the current database?</AlertDialog.Title>
          <AlertDialog.Description size="2">
            This replaces recipes, inventory, orders, and settings with the backup. The app reloads
            when the restore finishes.
          </AlertDialog.Description>
          <Flex gap="3" justify="end" mt="4">
            <AlertDialog.Cancel>
              <Button type="button" variant="soft" color="gray" disabled={busy}>
                Cancel
              </Button>
            </AlertDialog.Cancel>
            <AlertDialog.Action>
              <Button
                type="button"
                color="red"
                loading={busy}
                onClick={() => {
                  void restore();
                }}
              >
                Replace and reload
              </Button>
            </AlertDialog.Action>
          </Flex>
        </AlertDialog.Content>
      </AlertDialog.Root>
    </Flex>
  );
}

function backupMessage(caught: unknown, fallback: string): string {
  if (typeof caught === "string" && caught.trim()) {
    return caught;
  }
  if (caught instanceof Error && caught.message.trim()) {
    return caught.message;
  }
  if (isRecord(caught) && typeof caught.message === "string" && caught.message.trim()) {
    return caught.message;
  }
  return fallback;
}

function isRecord(value: unknown): value is { message?: unknown } {
  return typeof value === "object" && value !== null;
}
