import { Button, Flex } from "@radix-ui/themes";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmAction } from "@/components/ConfirmAction";

type NamedAction = {
  title: string;
  description: string;
  onAction: () => Promise<void>;
};

export function CatalogRecordActions({
  archived,
  onArchive,
  reset,
  deleteAction,
}: {
  archived: boolean;
  onArchive: (archived: boolean) => Promise<void>;
  reset?: NamedAction;
  deleteAction?: NamedAction;
}) {
  const [pending, setPending] = useState(false);

  async function run(action: () => Promise<void>) {
    setPending(true);
    try {
      await action();
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Could not update the catalog.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Flex direction="column" gap="2">
      <Flex gap="2" wrap="wrap">
        <Button
          type="button"
          variant="soft"
          color="gray"
          loading={pending}
          disabled={pending}
          onClick={() => {
            void run(() => onArchive(!archived));
          }}
        >
          {archived ? "Unarchive" : "Archive"}
        </Button>
        {reset ? (
          <ConfirmAction
            triggerLabel="Reset"
            title={reset.title}
            description={reset.description}
            actionLabel="Reset"
            color="gray"
            disabled={pending}
            loading={pending}
            onConfirm={() => {
              void run(reset.onAction);
            }}
          />
        ) : null}
        {deleteAction ? (
          <ConfirmAction
            triggerLabel="Delete"
            title={deleteAction.title}
            description={deleteAction.description}
            actionLabel="Delete"
            disabled={pending}
            loading={pending}
            onConfirm={() => {
              void run(deleteAction.onAction);
            }}
          />
        ) : null}
      </Flex>
    </Flex>
  );
}
