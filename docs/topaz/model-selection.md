# Model Selection

We recommend starting with what you are trying to do, then selecting the best model from there.

### Image

<details>

<summary>Upscale an Image</summary>

Three tiers, each with a different tradeoff:

|                 | Gigapixel                                            | Wonder                                                                     | Bloom                                                 |
| --------------- | ---------------------------------------------------- | -------------------------------------------------------------------------- | ----------------------------------------------------- |
| **Tier**        | Precision                                            | Generative                                                                 | Creative                                              |
| **Description** | Precision Image Upscale & Enhancement                | Generative Image Upscale & Enhancement                                     | Creative Image Upscale & Enhancement                  |
| **Intent**      | Improve resolution, preserve source characteristics. | Improve and restore by adding detail and texture, while preserving intent. | Transform with new, creative detail or stylization.   |
| **Use Case**    | General purpose upscaling & enhancement.             | Upcaling, restoring and improving low resolution or compressed sources.    | Upscaling, improving, and transforming GenAI sources. |

#### Gigapixel

| Model                                                                               | Use Case                                         |
| ----------------------------------------------------------------------------------- | ------------------------------------------------ |
| [`Standard 2`](/image-models/gigapixel/standard-2.md)                               | Default — works for most images                  |
| [`High Fidelity 2`](/image-models/gigapixel/high-fidelity-2.md)                     | Maximum source preservation                      |
| [`Low Resolution 2`](/image-models/gigapixel/low-resolution-2.md)                   | Very small inputs (thumbnails, web scrapes)      |
| [`Art & CGI`](/image-models/gigapixel/art-and-cgi.md)                               | Illustrations, renders, game assets, digital art |
| [`Text & Shapes`](/image-models/gigapixel/text-and-shapes.md)                       | Documents, screenshots, text-heavy images        |
| [`Recover Faces`](/image-models/gigapixel/recover-faces.md)                         | Portraits where facial detail is the priority    |
| [`Transparent Image Upscale`](/image-models/gigapixel/transparent-image-upscale.md) | PNGs with alpha channels                         |

#### Wonder

| Model                                                     | Use Case                                          |
| --------------------------------------------------------- | ------------------------------------------------- |
| [`Standard Max`](/image-models/wonder/standard-max.md)    | Default generative upscaling                      |
| [`Wonder 2`](/image-models/wonder/wonder-2.md)            | Stronger generation for more detail               |
| [`Redefine: Realistic`](/image-models/wonder/redefine.md) | Generative enhancement grounded in photorealism   |
| [`Redefine: Creative`](/image-models/wonder/redefine.md)  | Generative enhancement with more creative freedom |
| [`Recover 3`](/image-models/wonder/recover-3.md)          | Heavily degraded or damaged sources               |

#### Bloom

| Model                                                     | Use case                   |
| --------------------------------------------------------- | -------------------------- |
| [`Bloom Creative`](/image-models/bloom/bloom-creative.md) | Maximum stylization        |
| [`Bloom Realism`](/image-models/bloom/bloom-realism.md)   | Creative but more grounded |

</details>

<details>

<summary>Sharpen or Deblur</summary>

**Standard** — use when you know the blur type:

| Model                                                                             | Use case                                        |
| --------------------------------------------------------------------------------- | ----------------------------------------------- |
| [`Sharpen`](/image-models/removal-and-cleanup/sharpen/standard.md)                | General-purpose — good starting point           |
| [`Sharpen Strong`](/image-models/removal-and-cleanup/sharpen/strong.md)           | Noticeably soft images                          |
| [`Sharpen Natural`](/image-models/removal-and-cleanup/sharpen/natural.md)         | Subtle sharpening that avoids over-processing   |
| [`Sharpen Lens Blur 2`](/image-models/removal-and-cleanup/sharpen/lens-blur-2.md) | Optical blur from lens softness or missed focus |
| [`Sharpen Motion Blur`](/image-models/removal-and-cleanup/sharpen/motion-blur.md) | Blur from camera or subject movement            |
| [`Sharpen Refocus`](/image-models/removal-and-cleanup/sharpen/refocus.md)         | Slightly out-of-focus images                    |
| [`Portrait`](/image-models/removal-and-cleanup/sharpen/portrait.md)               | Optimized for faces and skin texture            |
| [`Wildlife`](/image-models/removal-and-cleanup/sharpen/wildlife.md)               | Optimized for fur, feathers, scales             |

**Generative** — use when the source is heavily degraded or you're unsure of the blur type:

| Model                                                                         | Use case                                                       |
| ----------------------------------------------------------------------------- | -------------------------------------------------------------- |
| [`Super Focus 2`](/image-models/removal-and-cleanup/sharpen/super-focus-2.md) | Generative sharpening that recovers detail beyond the original |

</details>

<details>

<summary>Reduce Noise or Grain</summary>

Pick based on noise severity:

| Model                                                                         | Use case                                              |
| ----------------------------------------------------------------------------- | ----------------------------------------------------- |
| [`Denoise Normal`](/image-models/denoise/normal.md)                           | Light noise — well-lit conditions                     |
| [`Denoise Strong`](/image-models/denoise/strong.md)                           | Moderate noise — high ISO, low light                  |
| [`Denoise Extreme`](/image-models/denoise/extreme.md)                         | Heavy noise — very high ISO, underexposed             |
| [`Dust & Scratch 2`](/image-models/removal-and-cleanup/dust-and-scratch-2.md) | Film scans or archival images with physical artifacts |

</details>

<details>

<summary>Remove Objects or Backgrounds</summary>

| Model                                                                               | Use case                                          |
| ----------------------------------------------------------------------------------- | ------------------------------------------------- |
| [`Background Removal`](/image-models/removal-and-cleanup/background-removal.md)     | Remove the background entirely                    |
| [`Image Object Matting`](/image-models/removal-and-cleanup/image-object-matting.md) | Extract subject with transparency for compositing |

</details>

<details>

<summary>Correct Color or Lighting</summary>

| Model                                                                          | Use case                                |
| ------------------------------------------------------------------------------ | --------------------------------------- |
| [`Balance Color`](/image-models/color-and-lighting/balance-color.md)           | Auto white balance and color correction |
| [`Adjust Lighting 2`](/image-models/color-and-lighting/adjust-lighting-2.md)   | Exposure and contrast adjustment        |
| [`Image Colorization`](/image-models/color-and-lighting/image-colorization.md) | Convert black-and-white to color        |

</details>

### Video

<details>

<summary>Upscale or Enhance a Video</summary>

Three families, each with a different tradeoff:

|                 | Proteus                                              | Starlight                                                                  | Astra                                                 |
| --------------- | ---------------------------------------------------- | -------------------------------------------------------------------------- | ----------------------------------------------------- |
| **Tier**        | Precision                                            | Generative                                                                 | Creative                                              |
| **Description** | Precision Video Upscale & Enhancement                | Generative Video Upscale & Enhancement                                     | Creative Video Upscale & Enhancement                  |
| **Intent**      | Improve resolution, preserve source characteristics. | Improve and restore by adding detail and texture, while preserving intent. | Transform with new, creative detail or stylization.   |
| **Use Case**    | General purpose upscaling & enhancement.             | Upcaling, restoring and improving archival and GenAI                       | Upscaling, improving, and transforming GenAI sources. |

#### Proteus

**Don't know where to start?** Use **Proteus**. Then narrow down if your source has specific characteristics:

| Model                                                                   | Use case                                                             |
| ----------------------------------------------------------------------- | -------------------------------------------------------------------- |
| [`Proteus`](/video-models/proteus/proteus.md)                           | Default — handles most content well                                  |
| [`Proteus Natural`](/video-models/proteus/proteus-natural.md)           | Lighter processing, stays closest to the original                    |
| [`Artemis HQ / MQ / LQ`](/video-models/proteus/artemis.md)              | Match to your source quality — HQ for clean footage, LQ for degraded |
| [`Artemis Aliasing/Moire`](/video-models/proteus/artemis.md)            | Visible aliasing or moire patterns                                   |
| [`Artemis Medium Halo / Strong Halo`](/video-models/proteus/artemis.md) | Halo artifacts from older upscaling or edge enhancement              |
| [`Dione TV / DV`](/video-models/proteus/dione.md)                       | Interlaced broadcast (TV) or camcorder (DV) footage                  |
| [`Dione Robust`](/video-models/proteus/dione.md)                        | Interlaced content with heavy degradation                            |
| [`Dione Dehalo / Robust Dehalo`](/video-models/proteus/dione.md)        | Interlaced content with halo artifacts                               |
| [`Gaia 2 (Animation)`](/video-models/proteus/gaia.md)                   | Animation and single-frame animation                                 |
| [`Gaia HQ / CG`](/video-models/proteus/gaia.md)                         | High-quality or general CG and rendered content                      |
| [`Iris MQ / LQ`](/video-models/proteus/iris.md)                         | Legacy content at medium or low quality                              |
| [`Rhea`](/video-models/proteus/rhea.md)                                 | General enhancement with natural texture                             |
| [`Theia Fine Tune Detail`](/video-models/proteus/theia.md)              | Push detail enhancement — more aggressive                            |
| [`Theia Fine Tune Fidelity`](/video-models/proteus/theia.md)            | Preserve original look — lighter touch                               |

#### Starlight

Quality and Fast subtiers. Use Quality when output matters most, Fast when speed or cost is the priority.

| Model                                                                              | Subtier | Use case                                   |
| ---------------------------------------------------------------------------------- | ------- | ------------------------------------------ |
| [`Starlight HQ`](/video-models/starlight/starlight-hq.md)                          | Quality | Maximum quality generative output          |
| [`Starlight Precise 2`](/video-models/starlight/starlight-precise-2-deprecated.md) | Quality | Default for most generative work           |
| [`Starlight Precise 1`](/video-models/starlight/starlight-precise-1-deprecated.md) | Quality | Highest fidelity to source                 |
| [`Starlight Sharp`](/video-models/starlight/starlight-sharp.md)                    | Quality | Emphasis on sharpness and edge detail      |
| [`Starlight Fast 2`](/video-models/starlight/starlight-fast-2.md)                  | Fast    | Best fast model — start here for speed     |
| [`Starlight Fast 1`](/video-models/starlight/starlight-fast-1-deprecated.md)       | Fast    | Speed-optimized generative enhancement     |
| [`Starlight Mini`](/video-models/starlight/starlight-mini.md)                      | Fast    | Lightest — previews or cost-sensitive jobs |

#### Astra

| Model                                                  | Use case                      |
| ------------------------------------------------------ | ----------------------------- |
| [`Astra 1`](/video-models/astra/astra-1-deprecated.md) | Creative video transformation |

</details>

<details>

<summary>Reduce Noise or Grain</summary>

#### Denoise

Quality and Fast subtiers via the Nyx family:

| Model                                                             | Subtier | Use case                                       |
| ----------------------------------------------------------------- | ------- | ---------------------------------------------- |
| [`Nyx`](/video-models/denoise/nyx.md)                             | Quality | Default — balanced noise reduction and detail  |
| [`Nyx XL`](/video-models/denoise/nyx-xl.md)                       | Quality | Stronger reduction for heavy noise             |
| [`Nyx High Fidelity`](/video-models/denoise/nyx-high-fidelity.md) | Quality | Maximum detail preservation, lighter reduction |
| [`Nyx Fast`](/video-models/denoise/nyx-fast.md)                   | Fast    | Speed-optimized denoising                      |

</details>

<details>

<summary>Change Frame Rate or Create Slow-Mo</summary>

#### Frame Interpolation

Quality and Fast subtiers. Generates new frames to increase frame rate or create slow motion.

| Model                                                     | Subtier | Use case                                                |
| --------------------------------------------------------- | ------- | ------------------------------------------------------- |
| [`Apollo`](/video-models/frame-interpolation/apollo.md)   | Quality | Default — best all-around quality                       |
| [`Chronos`](/video-models/frame-interpolation/chronos.md) | Quality | Alternative algorithm for fast action or complex scenes |
| [`Aion`](/video-models/frame-interpolation/aion.md)       | Quality | Additional option for specific content types            |
| [`Apollo Fast`](broken://pages/dNHtFXtpCMkrraa22s9w)      | Fast    | Speed-optimized                                         |
| [`Chronos Fast`](broken://pages/5rUaTuF8aMBBuSfjWfg0)     | Fast    | Speed-optimized alternative algorithm                   |

</details>

<details>

<summary>Deblur or Colorize</summary>

#### Video Utilities

| Model                                                                       | Use case                                              |
| --------------------------------------------------------------------------- | ----------------------------------------------------- |
| [`Themis 2`](/video-models/video-utilities/themis-2-motion-deblur.md)       | Remove motion blur from camera shake or fast movement |
| [`Video Colorization`](/video-models/video-utilities/video-colorization.md) | Convert B\&W or desaturated footage to color          |

</details>
