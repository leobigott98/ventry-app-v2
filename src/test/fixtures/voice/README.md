# Voice audio fixtures

`chromium-mediarecorder-8s.webm` is the non-sensitive `stream.weba` fixture from
the MIT-licensed `Borewit/music-metadata` test suite. Its EBML metadata identifies
both the muxing and writing application as `Chrome`; it contains one Opus audio
track, has no container `Duration` field, and lasts 8.464 seconds when duration is
derived from its clusters/blocks. It is retained under a `.webm` filename to match
the upload produced by Ventry's Chromium `MediaRecorder` flow.

Source:
https://github.com/Borewit/music-metadata/blob/master/test/samples/matroska/stream.weba

`webm-video-only.webm` is the test suite's valid VP8-only WebM fixture. It
verifies that a recognizable WebM container without an audio track is rejected.

Source:
https://github.com/Borewit/music-metadata/blob/master/test/samples/matroska/fixture-null.webm

`aac-tone-1s.m4a` is the one-second synthetic mono AAC tone fixture from the
`minutes-core` test resources. It covers the MP4/M4A container emitted by Safari
and iPhone voice recording without using a person's voice.

Source:
https://docs.rs/crate/minutes-core/0.25.1/source/resources/decode-fixture-tone.m4a
