# Third-Party Licenses

This application uses the following third-party software and libraries. We are grateful to the developers and contributors of these projects.

---

## VOICEVOX Engine

**Version**: 0.25.0
**Copyright**: Hiroshiba Kazuyuki
**License**: LGPL v3
**Website**: https://github.com/VOICEVOX/voicevox_engine

VOICEVOX Engine is distributed under the GNU Lesser General Public License v3.0 (LGPL v3).

### LGPL v3 Notice

This application uses VOICEVOX Engine as a separate executable process. The engine is licensed under LGPL v3, which allows you to:
- Use the engine for any purpose (commercial or non-commercial)
- Modify and redistribute the engine under LGPL v3 terms
- Replace the bundled engine with your own version

The full text of the LGPL v3 license can be found at:
https://www.gnu.org/licenses/lgpl-3.0.html

### Source Code Availability

The complete source code of VOICEVOX Engine is available at:
https://github.com/VOICEVOX/voicevox_engine

You can download, modify, and rebuild the engine following the instructions in the repository.

### Replacing the Engine

The VOICEVOX Engine runs as a separate process and can be replaced by:
1. Locating the engine directory in your installation
2. Replacing the engine executable with your modified version
3. Restarting the application

---

## VOICEVOX Core

VOICEVOX Engine includes VOICEVOX Core, which is also licensed under LGPL v3 or other licenses depending on the voice model used.

**Website**: https://github.com/VOICEVOX/voicevox_core

---

## Character Voice Models

The voice models included with VOICEVOX Engine (including Zundamon) have their own license terms. Please refer to the VOICEVOX Engine documentation for specific character license information:

- Zundamon (ずんだもん): Created by 坂本アヒル, licensed under specific terms
- Other characters: Each has individual license terms

For detailed character license information, visit:
https://voicevox.hiroshiba.jp/

---

## Node.js Dependencies

This application uses various Node.js packages, each with their own licenses:

### Major Dependencies

- **Electron** (v28.1.0) - MIT License
- **React** (v18.2.0) - MIT License
- **Express** (v4.18.2) - MIT License
- **Socket.IO** (v4.6.1) - MIT License
- **Axios** (v1.6.2) - MIT License
- **Tailwind CSS** (v3.4.0) - MIT License

Full dependency list with licenses can be found by running:
```
npm list --depth=0
```

---

## Microsoft Fluent Emoji

The application icon is based on Microsoft Fluent Emoji.

**Copyright**: Microsoft Corporation
**License**: MIT License
**Website**: https://github.com/microsoft/fluentui-emoji

---

## VB-CABLE Virtual Audio Device

**Copyright**: Vincent Burel - VB-Audio Software
**License**: Freeware (Donationware)
**Website**: https://vb-audio.com/Cable/

VB-CABLE is a virtual audio device working as a virtual audio cable. All audio coming in the CABLE input is simply forwarded to the CABLE output.

### License Terms

VB-CABLE is provided as freeware software. The installer is bundled with this application for user convenience (Windows only). Users are encouraged to support the developer through donations.

### Important Notes

1. VB-CABLE is optional and only required if you want to route audio to other applications (Discord, game voice chat, etc.)
2. The installer requires administrator privileges to install the audio driver
3. A system restart is required after installation
4. This application does not modify or redistribute VB-CABLE itself - it only provides the official installer

### Support the Developer

VB-CABLE is maintained by Vincent Burel at VB-Audio Software. If you find VB-CABLE useful, please consider making a donation at:
https://vb-audio.com/Cable/

---

## 7-Zip

**Copyright**: Igor Pavlov
**License**: GNU LGPL (with unRAR restriction)
**Website**: https://www.7-zip.org/

7-Zip is a file archiver with a high compression ratio. The application bundles 7za.exe (the standalone console version) for extracting VOICEVOX Engine archives.

### License Terms

Most of the 7-Zip source code is under the GNU LGPL license. The unRAR code is under a mixed license: GNU LGPL + unRAR restrictions.

Key points:
- 7-Zip is free software
- You can use 7-Zip on any computer, including commercial organizations
- You can distribute copies of 7-Zip under the terms of the GNU LGPL

### Source Code

The complete source code of 7-Zip is available at:
https://www.7-zip.org/download.html

### Important Notes

1. 7za.exe is the standalone console version that requires no installation
2. Used only for extracting VOICEVOX Engine archives during initial setup
3. Users can also use system-installed 7-Zip if available
4. The bundled version eliminates the need for separate 7-Zip installation

---

## License Compliance

This application complies with all license requirements:

1. **LGPL v3 Compliance**: VOICEVOX Engine is used as a separate process and can be independently replaced or modified
2. **Attribution**: All copyright notices and license information are preserved
3. **Source Code**: Links to source code repositories are provided
4. **MIT License**: Proper attribution is given to all MIT-licensed components

---

## Questions or Concerns

If you have any questions about licensing or notice any compliance issues, please contact the project maintainers or open an issue on the project repository.

Last Updated: 2025-11-10
