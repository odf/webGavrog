module View3d.RendererWebGLEffects exposing
    ( Mesh
    , convertMeshForRenderer
    , entities
    )

import Array exposing (Array)
import Math.Matrix4 as Mat4 exposing (Mat4)
import Math.Vector3 exposing (Vec3, vec3)
import Maybe
import View3d.Camera as Camera
import View3d.Mesh as Mesh
import View3d.RendererCommon exposing (..)
import WebGL
import WebGL.Settings
import WebGL.Settings.Blend as Blend
import WebGL.Settings.DepthTest as DepthTest


type alias VertexExtended =
    { position : Vec3
    , normal : Vec3
    , barycentric : Vec3
    }


type alias Mesh =
    WebGL.Mesh VertexExtended


type alias Uniforms =
    { sceneCenter : Vec3
    , sceneRadius : Float
    , color : Vec3
    , alpha : Float
    , fadeStrength : Float
    , blueShift : Float
    , wireStrength : Float
    , pushOut : Float
    , transform : Mat4
    , viewing : Mat4
    , perspective : Mat4
    }


type alias Varyings =
    { vpos : Vec3
    , vnormal : Vec3
    , vbary : Vec3
    }


extend : Vertex -> Float -> Float -> Float -> VertexExtended
extend v x y z =
    { position = v.position
    , normal = v.normal
    , barycentric = vec3 x y z
    }


convertMeshForRenderer : Mesh.Mesh Vertex -> Mesh
convertMeshForRenderer mesh =
    case mesh of
        Mesh.Lines _ ->
            WebGL.triangles []

        Mesh.Triangles triangles ->
            triangles
                |> List.map
                    (\( u, v, w ) ->
                        ( extend u 1 0 0, extend v 0 1 0, extend w 0 0 1 )
                    )
                |> WebGL.triangles

        Mesh.IndexedTriangles vertices triangles ->
            triangles
                |> List.map (\( i, j, k ) -> [ i, j, k ])
                |> Mesh.resolvedSurface vertices
                |> convertMeshForRenderer


entities : Array Mesh -> Model a -> Options -> List WebGL.Entity
entities meshes model options =
    let
        radius =
            3 * model.radius

        perspective =
            if options.orthogonalView then
                Camera.orthogonalMatrix model.cameraState model.center radius

            else
                Camera.perspectiveMatrix model.cameraState model.center radius

        viewing =
            Camera.viewingMatrix model.cameraState

        baseUniforms =
            { sceneCenter = Mat4.transform viewing model.center
            , sceneRadius = model.radius
            , color = vec3 0 0 0
            , alpha = 1.0
            , fadeStrength = 0.5 * options.fadeToBackground
            , blueShift = options.fadeToBlue
            , wireStrength = 0.0
            , pushOut = 0.0
            , transform = Mat4.identity
            , viewing = viewing
            , perspective = perspective
            }

        convert { transform } mesh =
            let
                uniforms =
                    { baseUniforms | transform = transform }

                drawFog =
                    (options.fadeToBackground > 0)
                        || (options.fadeToBlue > 0)
                        || options.drawWires

                fog =
                    if drawFog then
                        [ WebGL.entityWith
                            [ Blend.add Blend.srcAlpha Blend.oneMinusSrcAlpha
                            , DepthTest.default
                            , WebGL.Settings.polygonOffset -0.5 -1.0
                            ]
                            vertexShader
                            fragmentShaderFog
                            mesh
                            { uniforms
                                | color = options.backgroundColor
                                , wireStrength =
                                    if options.drawWires then
                                        0.8

                                    else
                                        0.0
                            }
                        ]

                    else
                        []

                outlines =
                    if options.addOutlines then
                        [ WebGL.entityWith
                            [ DepthTest.default
                            , WebGL.Settings.cullFace WebGL.Settings.front
                            ]
                            vertexShader
                            fragmentShaderConstant
                            mesh
                            { uniforms
                                | color = options.outlineColor
                                , pushOut = 0.02
                            }
                        ]

                    else
                        []
            in
            fog ++ outlines
    in
    model.scene
        |> List.concatMap
            (\item ->
                Array.get item.idxMesh meshes
                    |> Maybe.map (convert item)
                    |> Maybe.withDefault []
            )


vertexShader : WebGL.Shader VertexExtended Uniforms Varyings
vertexShader =
    [glsl|

    attribute vec3 position;
    attribute vec3 normal;
    attribute vec3 barycentric;
    uniform mat4 transform;
    uniform mat4 viewing;
    uniform mat4 perspective;
    uniform float pushOut;
    varying vec3 vpos;
    varying vec3 vnormal;
    varying vec3 vbary;

    void main () {
        vbary = barycentric;
        vnormal = normalize((viewing * transform * vec4(normal, 0.0)).xyz);
        vpos = (viewing * transform * vec4(position, 1.0)).xyz
            + pushOut * vnormal;
        gl_Position = perspective * vec4(vpos, 1.0);
    }

    |]


fragmentShaderFog : WebGL.Shader {} Uniforms Varyings
fragmentShaderFog =
    [glsl|

    precision mediump float;
    uniform vec3 sceneCenter;
    uniform float sceneRadius;
    uniform vec3 color;
    uniform float fadeStrength;
    uniform float blueShift;
    uniform float wireStrength;
    varying vec3 vpos;
    varying vec3 vnormal;
    varying vec3 vbary;

    void main () {
        float depth = (sceneCenter - vpos).z;
        float coeff = smoothstep(-0.9 * sceneRadius, 1.1 * sceneRadius, depth);

        // fade to blue

        float t = 0.0;
        float alpha = blueShift > 0.0 ? pow(coeff, 1.0 / blueShift) : 0.0;
        float beta = 0.0;
        vec3 colorOut = vec3(0.0, 0.0, 1.0);

        // fade to background

        t = fadeStrength > 0.0 ? pow(coeff, 1.0 / fadeStrength) : 0.0;
        alpha = t + alpha - t * alpha;
        beta = alpha > 0.0 ? t / alpha : 0.0;
        colorOut = beta * color + (1.0 - beta) * colorOut;

        // add wireframes

        vec3 delta = abs(dFdx(vbary)) + abs(dFdy(vbary));
        vec3 bary = smoothstep(0.5 * delta, delta, vbary);

        t = wireStrength * (1.0 - min(bary.x, min(bary.y, bary.z)));
        alpha = t + alpha - t * alpha;
        beta = alpha > 0.0 ? t / alpha : 0.0;
        colorOut = beta * vec3(0.0, 0.0, 0.0) + (1.0 - beta) * colorOut;

        // output

        gl_FragColor = vec4(colorOut, alpha);
    }

    |]


fragmentShaderConstant : WebGL.Shader {} Uniforms Varyings
fragmentShaderConstant =
    [glsl|

    precision mediump float;
    uniform vec3 color;
    uniform float alpha;
    varying vec3 vpos;
    varying vec3 vnormal;
    varying vec3 vbary;

    void main () {
        gl_FragColor = vec4(color, alpha);
    }

    |]
