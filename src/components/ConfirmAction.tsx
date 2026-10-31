import { AlertDialog, Button, Flex } from "@radix-ui/themes";

export function ConfirmAction({
  triggerLabel,
  title,
  description,
  actionLabel,
  color = "red",
  disabled = false,
  loading = false,
  onConfirm,
}: {
  triggerLabel: string;
  title: string;
  description: string;
  actionLabel: string;
  color?: "red" | "gray";
  disabled?: boolean;
  loading?: boolean;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog.Root>
      <AlertDialog.Trigger>
        <Button
          type="button"
          variant="soft"
          color={color}
          disabled={disabled || loading}
          loading={loading}
        >
          {triggerLabel}
        </Button>
      </AlertDialog.Trigger>
      <AlertDialog.Content maxWidth="28rem">
        <AlertDialog.Title>{title}</AlertDialog.Title>
        <AlertDialog.Description size="2">{description}</AlertDialog.Description>
        <Flex gap="3" justify="end" mt="4">
          <AlertDialog.Cancel>
            <Button type="button" variant="soft" color="gray">
              Cancel
            </Button>
          </AlertDialog.Cancel>
          <AlertDialog.Action>
            <Button type="button" color={color} loading={loading} onClick={onConfirm}>
              {actionLabel}
            </Button>
          </AlertDialog.Action>
        </Flex>
      </AlertDialog.Content>
    </AlertDialog.Root>
  );
}
