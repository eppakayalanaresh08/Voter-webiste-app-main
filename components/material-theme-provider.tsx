'use client';

import { CssBaseline, ThemeProvider, createTheme, type Shadows } from '@mui/material';

type MaterialThemeProviderProps = {
  children: React.ReactNode;
};

const flatShadows = Array.from({ length: 25 }, () => 'none') as Shadows;

const theme = createTheme({
  shadows: flatShadows,
  palette: {
    mode: 'light',
    primary: {
      main: '#0b57d0',
      light: '#d9e7ff',
      dark: '#083b91'
    },
    secondary: {
      main: '#4f6fa8'
    },
    text: {
      primary: '#12346b',
      secondary: '#5d7ba8'
    },
    divider: '#d9e4fb',
    background: {
      default: '#f3f7ff',
      paper: '#ffffff'
    }
  },
  shape: {
    borderRadius: 16
  },
  typography: {
    fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    h4: {
      fontWeight: 800,
      letterSpacing: '-0.03em'
    },
    h5: {
      fontWeight: 800,
      letterSpacing: '-0.03em'
    },
    h6: {
      fontWeight: 700
    },
    button: {
      fontWeight: 700
    }
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        html: {
          backgroundColor: '#f3f7ff'
        },
        body: {
          color: '#12346b',
          backgroundColor: '#f3f7ff',
          WebkitFontSmoothing: 'antialiased',
          MozOsxFontSmoothing: 'grayscale'
        },
        '::selection': {
          backgroundColor: '#d9e7ff',
          color: '#083b91'
        }
      }
    },
    MuiButtonBase: {
      styleOverrides: {
        root: {
          borderRadius: 'inherit'
        }
      }
    },
    MuiButton: {
      defaultProps: {
        disableElevation: true
      },
      styleOverrides: {
        root: {
          textTransform: 'none',
          minHeight: 44,
          borderRadius: 14,
          paddingInline: 16,
          fontWeight: 700,
          boxShadow: 'none'
        },
        contained: {
          backgroundColor: '#0b57d0',
          color: '#ffffff',
          '&:hover': {
            backgroundColor: '#0949b4',
            boxShadow: 'none'
          }
        },
        outlined: {
          borderColor: '#bfd3fb',
          color: '#0b57d0',
          '&:hover': {
            borderColor: '#0b57d0',
            backgroundColor: '#edf4ff'
          }
        },
        text: {
          color: '#0b57d0',
          '&:hover': {
            backgroundColor: '#edf4ff'
          }
        }
      }
    },
    MuiCard: {
      styleOverrides: {
        root: {
          border: '1px solid #d9e4fb',
          backgroundColor: '#ffffff',
          boxShadow: 'none'
        }
      }
    },
    MuiCardContent: {
      styleOverrides: {
        root: {
          padding: 20,
          '&:last-child': {
            paddingBottom: 20
          }
        }
      }
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          boxShadow: 'none',
          backgroundImage: 'none'
        }
      }
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          color: '#12346b',
          backgroundColor: '#ffffff',
          borderBottom: '1px solid #d9e4fb',
          backgroundImage: 'none',
          boxShadow: 'none'
        }
      }
    },
    MuiToolbar: {
      styleOverrides: {
        root: {
          minHeight: 68
        }
      }
    },
    MuiTextField: {
      defaultProps: {
        variant: 'outlined',
        size: 'medium'
      }
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 14,
          backgroundColor: '#ffffff',
          '& fieldset': {
            borderColor: '#c5d7ff'
          },
          '&:hover fieldset': {
            borderColor: '#87abff'
          },
          '&.Mui-focused fieldset': {
            borderColor: '#0b57d0',
            borderWidth: 1
          }
        },
        input: {
          paddingTop: 14,
          paddingBottom: 14
        }
      }
    },
    MuiInputLabel: {
      styleOverrides: {
        root: {
          color: '#5d7ba8'
        }
      }
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 999,
          backgroundColor: '#edf4ff',
          color: '#0b57d0'
        }
      }
    },
    MuiAlert: {
      styleOverrides: {
        root: {
          borderRadius: 14,
          boxShadow: 'none'
        },
        standardInfo: {
          backgroundColor: '#edf4ff',
          color: '#0b57d0'
        },
        standardSuccess: {
          backgroundColor: '#edf4ff',
          color: '#0b57d0'
        },
        standardWarning: {
          backgroundColor: '#fff6e8',
          color: '#8b5e00'
        },
        standardError: {
          backgroundColor: '#fff0f0',
          color: '#b3261e'
        }
      }
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          borderColor: '#e3ebff'
        },
        head: {
          color: '#5d7ba8',
          fontWeight: 700
        }
      }
    },
    MuiMenu: {
      styleOverrides: {
        paper: {
          border: '1px solid #d9e4fb',
          boxShadow: 'none'
        }
      }
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          border: '1px solid #d9e4fb',
          boxShadow: 'none'
        }
      }
    },
    MuiPopover: {
      styleOverrides: {
        paper: {
          border: '1px solid #d9e4fb',
          boxShadow: 'none'
        }
      }
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          backgroundColor: '#12346b'
        }
      }
    }
  }
});

export default function MaterialThemeProvider({ children }: MaterialThemeProviderProps) {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  );
}
