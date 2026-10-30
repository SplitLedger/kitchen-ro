import { MoonIcon, SunIcon } from "@radix-ui/react-icons";
import { Box, Button, Flex, IconButton, Text } from "@radix-ui/themes";
import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import { useAppState } from "@/providers/AppStateProvider";

const navItems = [
  { to: "/catalog", label: "Catalog" },
  { to: "/ingredients", label: "Ingredients" },
  { to: "/prices", label: "Prices" },
  { to: "/orders", label: "Orders" },
  { to: "/settings", label: "Settings" },
] as const;

export function AppFrame() {
  const { settings, setTheme } = useAppState();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nextTheme = settings.theme === "dark" ? "light" : "dark";

  async function toggleTheme() {
    setSaving(true);
    setError(null);
    try {
      await setTheme(nextTheme);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save the theme.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Flex direction="column" style={{ minHeight: "100vh" }}>
      <Box px="4" py="3" style={{ borderBottom: "1px solid var(--gray-a6)" }}>
        <Flex align="center" justify="between" gap="4">
          <Text size="5" weight="bold">
            Kitchen RO
          </Text>
          <IconButton
            aria-label={nextTheme === "dark" ? "Use dark theme" : "Use light theme"}
            variant="soft"
            color="gray"
            disabled={saving}
            onClick={() => {
              void toggleTheme();
            }}
          >
            {nextTheme === "dark" ? <MoonIcon /> : <SunIcon />}
          </IconButton>
        </Flex>
        <Flex aria-label="Primary" asChild gap="2" mt="3" wrap="wrap">
          <nav>
            {navItems.map((item) => {
              const active = pathname === item.to || pathname.startsWith(`${item.to}/`);
              return (
                <Button
                  key={item.to}
                  asChild
                  variant={active ? "solid" : "soft"}
                  color={active ? undefined : "gray"}
                >
                  <Link to={item.to}>{item.label}</Link>
                </Button>
              );
            })}
          </nav>
        </Flex>
        {error ? (
          <Text as="p" color="red" mt="2">
            {error}
          </Text>
        ) : null}
      </Box>
      <Box asChild flexGrow="1" p="5">
        <main>
          <Outlet />
        </main>
      </Box>
    </Flex>
  );
}
