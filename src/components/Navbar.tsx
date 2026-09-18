import { useState, useEffect, type FC, type MouseEvent } from 'react';
import {
  Box,
  Typography,
  Menu,
  MenuItem,
  ListItemIcon,
  Divider,
  IconButton,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
} from '@mui/material';
import PersonOutlineRoundedIcon from '@mui/icons-material/PersonOutlineRounded';
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded';
import AdminPanelSettingsRoundedIcon from '@mui/icons-material/AdminPanelSettingsRounded';
import SettingsRoundedIcon from '@mui/icons-material/SettingsRounded';
import MenuRoundedIcon from '@mui/icons-material/MenuRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import PeopleAltRoundedIcon from '@mui/icons-material/PeopleAltRounded';
import ReceiptLongRoundedIcon from '@mui/icons-material/ReceiptLongRounded';
import CategoryRoundedIcon from '@mui/icons-material/CategoryRounded';
import FormatListNumberedRoundedIcon from '@mui/icons-material/FormatListNumberedRounded';
import Inventory2RoundedIcon from '@mui/icons-material/Inventory2Rounded';
import { getStoredSettings, type CompanySettings } from './SettingsPage';
import sivaBalajiLogo from '../assets/siva-balaji.jpeg';

export type NavTab = 'All Customers' | 'Billing' | 'Categories' | 'Price List' | 'Product' | 'Settings';

interface NavbarProps {
  activeTab?: NavTab;
  onSelectTab?: (tab: NavTab) => void;
  onLogout?: () => void;
}

const TAB_ICONS: Record<NavTab, React.ReactElement> = {
  'All Customers': <PeopleAltRoundedIcon sx={{ fontSize: 20 }} />,
  'Billing': <ReceiptLongRoundedIcon sx={{ fontSize: 20 }} />,
  'Categories': <CategoryRoundedIcon sx={{ fontSize: 20 }} />,
  'Price List': <FormatListNumberedRoundedIcon sx={{ fontSize: 20 }} />,
  'Product': <Inventory2RoundedIcon sx={{ fontSize: 20 }} />,
  'Settings': <SettingsRoundedIcon sx={{ fontSize: 20 }} />,
};

export const Navbar: FC<NavbarProps> = ({
  activeTab = 'All Customers',
  onSelectTab,
  onLogout,
}) => {
  const tabs: NavTab[] = ['All Customers', 'Billing', 'Categories', 'Price List', 'Product', 'Settings'];
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [companySettings, setCompanySettings] = useState<CompanySettings>(getStoredSettings);

  useEffect(() => {
    const handleSettingsUpdate = () => {
      setCompanySettings(getStoredSettings());
    };
    window.addEventListener('dheeksha_settings_updated', handleSettingsUpdate);
    return () => {
      window.removeEventListener('dheeksha_settings_updated', handleSettingsUpdate);
    };
  }, []);

  const handleProfileClick = (event: MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleCloseMenu = () => {
    setAnchorEl(null);
  };

  const handleTabClick = (tab: NavTab) => {
    if (onSelectTab) {
      onSelectTab(tab);
    }
    setMobileDrawerOpen(false);
  };

  const handleSettingsClick = () => {
    handleCloseMenu();
    if (onSelectTab) {
      onSelectTab('Settings');
    }
  };

  const handleLogoutClick = () => {
    handleCloseMenu();
    setMobileDrawerOpen(false);
    if (onLogout) {
      onLogout();
    }
  };

  return (
    <>
      <Box
        component="header"
        sx={{
          backgroundColor: '#FFFFFF',
          borderBottom: '1.5px solid #FDE68A',
          px: { xs: 1.5, sm: 2.5, md: 4 },
          height: { xs: 58, sm: 66 },
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          position: 'sticky',
          top: 0,
          zIndex: 1100,
          boxSizing: 'border-box',
          boxShadow: '0 4px 20px -2px rgba(217, 119, 6, 0.08)',
        }}
      >
        {/* Left Logo Section */}
        <Box
          onClick={() => handleTabClick('All Customers')}
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.2,
            cursor: 'pointer',
            minWidth: 0,
            maxWidth: { xs: '65%', sm: 'auto' },
          }}
        >
          {/* Logo */}
          <Box
            component="img"
            src={companySettings.logoUrl || sivaBalajiLogo}
            alt="Siva Balaji Crackers"
            sx={{
              height: { xs: 34, sm: 42 },
              maxWidth: { xs: 44, sm: 54 },
              width: 'auto',
              objectFit: 'contain',
              borderRadius: '6px',
              backgroundColor: 'transparent',
              filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.12))',
              display: 'block',
              flexShrink: 0,
            }}
          />

          <Box sx={{ minWidth: 0, overflow: 'hidden' }}>
            <Typography
              variant="h6"
              sx={{
                fontWeight: 800,
                fontSize: { xs: '14.5px', sm: '17px' },
                color: '#B91C1C',
                letterSpacing: '-0.02em',
                lineHeight: 1.15,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {companySettings.companyName || 'Siva Balaji Crackers'}
            </Typography>
            <Typography
              sx={{
                fontSize: { xs: '9px', sm: '10.5px' },
                fontWeight: 700,
                color: '#D97706',
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {companySettings.tagline || (companySettings.city ? `${companySettings.city}` : 'Siva Balaji Crackers')}
            </Typography>
          </Box>
        </Box>

        {/* Center Desktop Navigation Links (Hidden on Mobile/Tablet) */}
        <Box
          component="nav"
          sx={{
            display: { xs: 'none', md: 'flex' },
            alignItems: 'center',
            gap: { md: 2.5, lg: 3.5 },
            height: '100%',
          }}
        >
          {tabs.map((tab) => {
            const isActive = activeTab === tab;
            return (
              <Box
                key={tab}
                onClick={() => handleTabClick(tab)}
                sx={{
                  position: 'relative',
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  px: 0.5,
                }}
              >
                <Typography
                  sx={{
                    fontWeight: isActive ? 800 : 600,
                    fontSize: '14px',
                    color: isActive ? '#B91C1C' : '#57463A',
                    letterSpacing: '-0.01em',
                    transition: 'all 0.15s ease',
                    '&:hover': {
                      color: '#B91C1C',
                    },
                  }}
                >
                  {tab}
                </Typography>

                {/* Active indicator underline bar */}
                {isActive && (
                  <Box
                    sx={{
                      position: 'absolute',
                      bottom: 0,
                      left: 0,
                      right: 0,
                      height: '3.5px',
                      background: 'linear-gradient(90deg, #DC2626 0%, #F59E0B 100%)',
                      borderTopLeftRadius: '3px',
                      borderTopRightRadius: '3px',
                      boxShadow: '0 -2px 6px rgba(220, 38, 38, 0.35)',
                    }}
                  />
                )}
              </Box>
            );
          })}
        </Box>

        {/* Right Action Section */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0.8, sm: 1.5 } }}>
          {/* Profile Avatar Button */}
          <Box
            onClick={handleProfileClick}
            sx={{
              width: { xs: 32, sm: 36 },
              height: { xs: 32, sm: 36 },
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #1E40AF 0%, #1E3A8A 100%)',
              border: '1.5px solid #FDE68A',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              boxShadow: '0 2px 6px rgba(30, 64, 175, 0.3)',
              '&:hover': {
                transform: 'scale(1.06)',
              },
            }}
          >
            <PersonOutlineRoundedIcon sx={{ fontSize: { xs: 18, sm: 20 }, color: '#FFFFFF' }} />
          </Box>

          {/* Mobile Hamburger Menu Button (Visible only on mobile/tablet) */}
          <IconButton
            onClick={() => setMobileDrawerOpen(true)}
            sx={{
              display: { xs: 'flex', md: 'none' },
              color: '#B91C1C',
              backgroundColor: '#FFFBEB',
              border: '1px solid #FDE68A',
              p: 0.8,
              borderRadius: '8px',
              '&:hover': {
                backgroundColor: '#FEF3C7',
              },
            }}
          >
            <MenuRoundedIcon sx={{ fontSize: 22 }} />
          </IconButton>
        </Box>

        {/* Profile / Logout Popup Menu */}
        <Menu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={handleCloseMenu}
          transformOrigin={{ horizontal: 'right', vertical: 'top' }}
          anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
          slotProps={{
            paper: {
              sx: {
                borderRadius: '12px',
                minWidth: '170px',
                boxShadow: '0 8px 30px rgba(217, 119, 6, 0.15)',
                border: '1.5px solid #FDE68A',
                backgroundColor: '#FFFFFF',
                mt: 1,
              },
            },
          }}
        >
          <MenuItem disabled sx={{ opacity: '1 !important', py: 1.2 }}>
            <ListItemIcon>
              <AdminPanelSettingsRoundedIcon sx={{ fontSize: 20, color: '#B91C1C' }} />
            </ListItemIcon>
            <Box>
              <Typography sx={{ fontSize: '13px', fontWeight: 700, color: '#1F1714' }}>
                Administrator
              </Typography>
              <Typography sx={{ fontSize: '11px', color: '#D97706', fontWeight: 600 }}>
                Logged In
              </Typography>
            </Box>
          </MenuItem>
          <Divider sx={{ my: 0.5, borderColor: '#FEF3C7' }} />
          <MenuItem
            onClick={handleSettingsClick}
            sx={{ py: 1 }}
          >
            <ListItemIcon>
              <SettingsRoundedIcon sx={{ fontSize: 18, color: '#B91C1C' }} />
            </ListItemIcon>
            <Typography sx={{ fontSize: '13px', fontWeight: 600, color: '#1F1714' }}>
              Software Settings
            </Typography>
          </MenuItem>
          <MenuItem onClick={handleLogoutClick} sx={{ color: '#DC2626', py: 1 }}>
            <ListItemIcon>
              <LogoutRoundedIcon sx={{ fontSize: 18, color: '#DC2626' }} />
            </ListItemIcon>
            <Typography sx={{ fontSize: '13px', fontWeight: 700 }}>
              Logout
            </Typography>
          </MenuItem>
        </Menu>
      </Box>

      {/* Mobile Horizontal Touch Tab Bar (Quick thumb scrolling under Navbar on Mobile) */}
      <Box
        sx={{
          display: { xs: 'flex', md: 'none' },
          alignItems: 'center',
          gap: 1,
          px: 1.5,
          py: 0.8,
          backgroundColor: '#FFFFFF',
          borderBottom: '1px solid #FDE68A',
          overflowX: 'auto',
          scrollbarWidth: 'none',
          '&::-webkit-scrollbar': { display: 'none' },
          position: 'sticky',
          top: '58px',
          zIndex: 1090,
        }}
      >
        {tabs.map((tab) => {
          const isActive = activeTab === tab;
          return (
            <Box
              key={tab}
              onClick={() => handleTabClick(tab)}
              sx={{
                px: 1.4,
                py: 0.6,
                borderRadius: '20px',
                backgroundColor: isActive ? '#DC2626' : '#FFFBEB',
                color: isActive ? '#FFFFFF' : '#78350F',
                border: isActive ? '1px solid #B91C1C' : '1px solid #FDE68A',
                fontSize: '12px',
                fontWeight: 700,
                whiteSpace: 'nowrap',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 0.6,
                flexShrink: 0,
                transition: 'all 0.15s ease',
              }}
            >
              {TAB_ICONS[tab]}
              {tab}
            </Box>
          );
        })}
      </Box>

      {/* Mobile Slide-Out Drawer Menu */}
      <Drawer
        anchor="right"
        open={mobileDrawerOpen}
        onClose={() => setMobileDrawerOpen(false)}
        slotProps={{
          paper: {
            sx: {
              width: '280px',
              backgroundColor: '#FEFDF9',
              borderLeft: '2px solid #FDE68A',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            },
          },
        }}
      >
        <Box>
          {/* Drawer Header */}
          <Box
            sx={{
              p: 2,
              background: 'linear-gradient(135deg, #DC2626 0%, #991B1B 100%)',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: '2px solid #F59E0B',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
              <Box
                component="img"
                src={companySettings.logoUrl || sivaBalajiLogo}
                alt="Logo"
                sx={{ width: 32, height: 32, objectFit: 'contain', borderRadius: '4px' }}
              />
              <Box>
                <Typography sx={{ fontSize: '15px', fontWeight: 800 }}>
                  {companySettings.companyName || 'Siva Balaji Crackers'}
                </Typography>
                <Typography sx={{ fontSize: '11px', color: '#FEF08A', fontWeight: 600 }}>
                  Main Navigation
                </Typography>
              </Box>
            </Box>
            <IconButton onClick={() => setMobileDrawerOpen(false)} sx={{ color: '#FFFFFF' }}>
              <CloseRoundedIcon sx={{ fontSize: 20 }} />
            </IconButton>
          </Box>

          {/* Drawer Navigation List */}
          <List sx={{ p: 1 }}>
            {tabs.map((tab) => {
              const isActive = activeTab === tab;
              return (
                <ListItem key={tab} disablePadding sx={{ mb: 0.5 }}>
                  <ListItemButton
                    onClick={() => handleTabClick(tab)}
                    sx={{
                      borderRadius: '10px',
                      backgroundColor: isActive ? '#FEF3C7' : 'transparent',
                      border: isActive ? '1px solid #FDE68A' : '1px solid transparent',
                      color: isActive ? '#B91C1C' : '#1F1714',
                      py: 1.2,
                      '&:hover': {
                        backgroundColor: '#FFFBEB',
                      },
                    }}
                  >
                    <ListItemIcon sx={{ color: isActive ? '#B91C1C' : '#786C58', minWidth: '36px' }}>
                      {TAB_ICONS[tab]}
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Typography sx={{ fontSize: '14px', fontWeight: isActive ? 800 : 600 }}>
                          {tab}
                        </Typography>
                      }
                    />
                  </ListItemButton>
                </ListItem>
              );
            })}
          </List>
        </Box>

        {/* Drawer Bottom Logout Button */}
        <Box sx={{ p: 2, borderTop: '1px solid #FDE68A' }}>
          <ListItemButton
            onClick={handleLogoutClick}
            sx={{
              borderRadius: '10px',
              backgroundColor: '#FEF2F2',
              border: '1px solid #FECACA',
              color: '#DC2626',
              py: 1,
              '&:hover': {
                backgroundColor: '#FEE2E2',
              },
            }}
          >
            <ListItemIcon sx={{ color: '#DC2626', minWidth: '36px' }}>
              <LogoutRoundedIcon sx={{ fontSize: 20 }} />
            </ListItemIcon>
            <ListItemText
              primary={
                <Typography sx={{ fontSize: '14px', fontWeight: 700 }}>
                  Logout
                </Typography>
              }
            />
          </ListItemButton>
        </Box>
      </Drawer>
    </>
  );
};
