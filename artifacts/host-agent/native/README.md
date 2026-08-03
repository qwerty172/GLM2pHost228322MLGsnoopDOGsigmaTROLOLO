# ViGEmClient.dll (native)

Bundled into the Windows installer via `electron-builder` `extraResources`.
Source: [ViGEmClient](https://github.com/nefarius/ViGEmClient) (MIT).

## Obtain the DLL

```sh
node scripts/fetch-vigem-dll.mjs
```

Or copy `ViGEmClient.dll` from a ViGEmBus installation:

`C:\Program Files\Nefarius Software Solutions\ViGEm Bus Driver\ViGEmClient.dll`

## Host requirement

The **ViGEmBus** kernel driver must be installed on the host PC for virtual gamepad injection.
Download: https://github.com/nefarius/ViGEmBus/releases

Without ViGEmBus, mobile touch-overlay gamepad input is received but not injected into games.
