import { MoonIcon, SunIcon } from "@radix-ui/react-icons";
import { Box, Button, Flex, IconButton, Text } from "@radix-ui/themes";
import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { useAppState } from "@/providers/AppStateProvider";

const navItems = [
  { to: "/inventory", label: "Inventory" },
  { to: "/orders", label: "Orders" },
  { to: "/catalog", label: "Catalog" },
  { to: "/ingredients", label: "Ingredients" },
  { to: "/settings", label: "Settings" },
] as const;

export function AppFrame() {
  const { settings, setTheme } = useAppState();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const [saving, setSaving] = useState(false);
  const nextTheme = settings.theme === "dark" ? "light" : "dark";

  async function toggleTheme() {
    setSaving(true);
    try {
      await setTheme(nextTheme);
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Could not save the theme.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Flex direction="column" style={{ minHeight: "100vh" }}>
      <Box
        className="no-print"
        px={{ initial: "4", md: "5" }}
        py="3"
        style={{ borderBottom: "1px solid var(--gray-a6)" }}
      >
        <Flex
          align={{ sm: "center" }}
          direction={{ initial: "column", sm: "row" }}
          gap="3"
          justify="between"
        >
          <Flex align="center" justify="between" gap="3">
            <Text size="5" weight="bold">
              Kitchen RO
            </Text>
            <Box display={{ sm: "none" }}>
              <ThemeToggle
                nextTheme={nextTheme}
                saving={saving}
                onToggle={() => void toggleTheme()}
              />
            </Box>
          </Flex>
          <Flex aria-label="Primary" asChild flexGrow="1" gap="2" wrap="wrap">
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
          <Box display={{ initial: "none", sm: "block" }}>
            <ThemeToggle
              nextTheme={nextTheme}
              saving={saving}
              onToggle={() => void toggleTheme()}
            />
          </Box>
        </Flex>
      </Box>
      <Box asChild className="app-main" flexGrow="1" p={{ initial: "4", md: "5", lg: "6" }}>
        <main>
          <Outlet />
        </main>
      </Box>
    </Flex>
  );
}

function ThemeToggle({
  nextTheme,
  saving,
  onToggle,
}: {
  nextTheme: "light" | "dark";
  saving: boolean;
  onToggle: () => void;
}) {
  return (
    <IconButton
      aria-label={nextTheme === "dark" ? "Use dark theme" : "Use light theme"}
      variant="soft"
      color="gray"
      loading={saving}
      disabled={saving}
      onClick={onToggle}
    >
      {nextTheme === "dark" ? <MoonIcon /> : <SunIcon />}
    </IconButton>
  );
}
