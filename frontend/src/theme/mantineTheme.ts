import {
  ActionIcon,
  AppShell,
  Badge,
  Button,
  Card,
  Drawer,
  Modal,
  Notification,
  Paper,
  Select,
  Tabs,
  TextInput,
  Textarea,
  createTheme,
  rem,
} from '@mantine/core'

const sharedSurface = {
  background: 'var(--glass)',
  border: '1px solid var(--border)',
  boxShadow: 'var(--shadow-sm)',
  backdropFilter: 'blur(20px) saturate(180%)',
  WebkitBackdropFilter: 'blur(20px) saturate(180%)',
  color: 'var(--text-primary)',
}

const sharedInput = {
  background: 'var(--surface-soft)',
  border: '1px solid var(--border)',
  color: 'var(--text-primary)',
  '&::placeholder': {
    color: 'var(--text-tertiary)',
  },
  '&:focus, &:focus-within': {
    borderColor: 'var(--accent)',
    boxShadow: '0 0 0 1px var(--accent-border)',
  },
}

export const mantineTheme = createTheme({
  fontFamily: "'IBM Plex Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  headings: {
    fontFamily: "'Space Grotesk', 'IBM Plex Sans', sans-serif",
    fontWeight: '700',
  },
  primaryColor: 'morpheus',
  colors: {
    morpheus: [
      '#eef6f4',
      '#d8ebe6',
      '#c1dfd8',
      '#a2cdc3',
      '#83bbb0',
      '#6ba89c',
      '#5a978c',
      '#4d8f83',
      '#3d7369',
      '#2d584f',
    ],
  },
  radius: {
    xs: rem(8),
    sm: rem(10),
    md: rem(12),
    lg: rem(16),
    xl: rem(20),
  },
  defaultRadius: 'md',
  shadows: {
    xs: 'var(--shadow-sm)',
    sm: 'var(--shadow-sm)',
    md: 'var(--shadow-md)',
    lg: 'var(--shadow-lg)',
    xl: 'var(--shadow-xl)',
  },
  defaultGradient: { from: 'morpheus.5', to: 'morpheus.7', deg: 125 },
  components: {
    AppShell: AppShell.extend({
      styles: {
        root: {
          background: 'transparent',
        },
        header: {
          background: 'var(--glass-strong)',
          borderBottom: '1px solid var(--border)',
          backdropFilter: 'blur(18px) saturate(170%)',
          WebkitBackdropFilter: 'blur(18px) saturate(170%)',
        },
        main: {
          background: 'transparent',
          color: 'var(--text-primary)',
        },
      },
    }),
    Paper: Paper.extend({
      defaultProps: {
        radius: 'lg',
        shadow: 'xs',
      },
      styles: {
        root: sharedSurface,
      },
    }),
    Card: Card.extend({
      defaultProps: {
        radius: 'lg',
        shadow: 'xs',
      },
      styles: {
        root: {
          ...sharedSurface,
          background: 'var(--surface-card)',
        },
      },
    }),
    Button: Button.extend({
      defaultProps: {
        radius: 'xl',
        size: 'sm',
      },
      styles: (_, props) => ({
        root: {
          fontWeight: 600,
          letterSpacing: '-0.01em',
          transition: 'transform 180ms ease, box-shadow 180ms ease, background 180ms ease, border-color 180ms ease',
          border:
            props.variant === 'filled'
              ? '1px solid var(--button-primary-border)'
              : '1px solid var(--button-secondary-border)',
          background:
            props.variant === 'filled'
              ? 'linear-gradient(125deg, var(--accent), var(--accent-hover))'
              : 'var(--button-secondary-bg)',
          color: props.variant === 'filled' ? 'var(--palette-button-text)' : 'var(--button-secondary-text)',
          boxShadow: props.variant === 'filled' ? '0 10px 22px var(--button-primary-shadow)' : 'none',
          '&:hover': {
            transform: 'translateY(-1px)',
            background:
              props.variant === 'filled'
                ? 'linear-gradient(125deg, var(--accent-hover), var(--accent))'
                : 'var(--button-secondary-hover-bg)',
          },
          '&:disabled': {
            opacity: 0.5,
            transform: 'none',
            boxShadow: 'none',
          },
        },
      }),
    }),
    ActionIcon: ActionIcon.extend({
      defaultProps: {
        variant: 'subtle',
        radius: 'xl',
      },
      styles: {
        root: {
          color: 'var(--text-primary)',
          border: '1px solid transparent',
          '&:hover': {
            background: 'var(--glass-hover)',
            borderColor: 'var(--accent-border)',
          },
        },
      },
    }),
    Badge: Badge.extend({
      styles: {
        root: {
          background: 'var(--accent-subtle)',
          border: '1px solid var(--accent-border)',
          color: 'var(--text-primary)',
          textTransform: 'none',
        },
      },
    }),
    TextInput: TextInput.extend({
      styles: {
        input: sharedInput,
      },
    }),
    Textarea: Textarea.extend({
      styles: {
        input: sharedInput,
      },
    }),
    Select: Select.extend({
      styles: {
        input: sharedInput,
        dropdown: {
          ...sharedSurface,
          background: 'var(--glass-strong)',
        },
        option: {
          color: 'var(--text-primary)',
          '&[data-checked]': {
            background: 'var(--accent-subtle)',
            color: 'var(--text-primary)',
          },
        },
      },
    }),
    Tabs: Tabs.extend({
      styles: {
        tab: {
          color: 'var(--text-secondary)',
          borderRadius: rem(999),
          '&[data-active]': {
            background: 'var(--accent-subtle)',
            color: 'var(--text-primary)',
            borderColor: 'transparent',
          },
        },
        list: {
          gap: rem(6),
          borderColor: 'var(--border)',
        },
        panel: {
          paddingTop: rem(16),
        },
      },
    }),
    Drawer: Drawer.extend({
      styles: {
        content: {
          background: 'var(--surface-paper)',
          color: 'var(--text-primary)',
        },
        header: {
          background: 'transparent',
          borderBottom: '1px solid var(--border)',
        },
      },
    }),
    Modal: Modal.extend({
      styles: {
        content: {
          background: 'var(--surface-paper)',
          color: 'var(--text-primary)',
        },
        header: {
          background: 'transparent',
          borderBottom: '1px solid var(--border)',
        },
      },
    }),
    Notification: Notification.extend({
      styles: {
        root: {
          ...sharedSurface,
          background: 'var(--surface-card-strong)',
        },
        description: {
          color: 'var(--text-secondary)',
        },
      },
    }),
  },
})
