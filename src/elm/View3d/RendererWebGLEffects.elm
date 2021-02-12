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


type alias Mesh =
    { surface : WebGL.Mesh Vertex
    , wireframe : WebGL.Mesh Vertex
    }


type alias Uniforms =
    { sceneCenter : Vec3
    , sceneRadius : Float
    , fadeColor : Vec3
    , fadeStrength : Float
    , blueShift : Float
    , fragmentColor : Vec3
    , pushOut : Float
    , transform : Mat4
    , viewing : Mat4
    , perspective : Mat4
    }


type alias Varyings =
    { vpos : Vec3
    , vnormal : Vec3
    }


convertSurface : Mesh.Mesh Vertex -> WebGL.Mesh Vertex
convertSurface mesh =
    case mesh of
        Mesh.Lines _ ->
            WebGL.triangles []

        Mesh.Triangles triangles ->
            WebGL.triangles triangles

        Mesh.IndexedTriangles vertices triangles ->
            WebGL.indexedTriangles vertices triangles


convertWireframe : Mesh.Mesh Vertex -> WebGL.Mesh Vertex
convertWireframe mesh =
    case mesh of
        Mesh.Lines lines ->
            WebGL.lines lines

        Mesh.Triangles _ ->
            WebGL.lines []

        Mesh.IndexedTriangles _ _ ->
            WebGL.lines []


convertMeshForRenderer : Mesh.Mesh Vertex -> Mesh
convertMeshForRenderer mesh =
    { surface = convertSurface mesh
    , wireframe = convertWireframe (Mesh.wireframe mesh)
    }


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
            , fadeColor = options.backgroundColor
            , fadeStrength = 0.5 * options.fadeToBackground
            , blueShift = options.fadeToBlue
            , fragmentColor = vec3 0 0 0
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
                    options.fadeToBackground > 0 || options.fadeToBlue > 0

                fog =
                    if drawFog then
                        [ WebGL.entityWith
                            [ Blend.add Blend.srcAlpha Blend.oneMinusSrcAlpha
                            , DepthTest.default
                            , WebGL.Settings.polygonOffset -0.5 -1.0
                            ]
                            vertexShader
                            fragmentShaderFog
                            mesh.surface
                            uniforms
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
                            mesh.surface
                            { uniforms
                                | fragmentColor = options.outlineColor
                                , pushOut = 0.02
                            }
                        ]

                    else
                        []

                wireframes =
                    if options.drawWires then
                        [ WebGL.entity
                            vertexShader
                            fragmentShaderConstant
                            mesh.wireframe
                            { uniforms | pushOut = 0.001 }
                        ]

                    else
                        []
            in
            fog ++ outlines ++ wireframes
    in
    model.scene
        |> List.concatMap
            (\item ->
                Array.get item.idxMesh meshes
                    |> Maybe.map (convert item)
                    |> Maybe.withDefault []
            )


vertexShader : WebGL.Shader Vertex Uniforms Varyings
vertexShader =
    [glsl|

    attribute vec3 position;
    attribute vec3 normal;
    uniform mat4 transform;
    uniform mat4 viewing;
    uniform mat4 perspective;
    uniform float pushOut;
    varying vec3 vpos;
    varying vec3 vnormal;

    void main () {
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
    uniform vec3 fadeColor;
    uniform float fadeStrength;
    uniform float blueShift;
    varying vec3 vpos;
    varying vec3 vnormal;

    void main () {
        float depth = (sceneCenter - vpos).z;
        float coeff = smoothstep(-0.9 * sceneRadius, 1.1 * sceneRadius, depth);
        float s = fadeStrength > 0.0 ? pow(coeff, 1.0 / fadeStrength) : 0.0;
        float t = blueShift > 0.0 ? pow(coeff, 1.0 / blueShift) : 0.0;

        float alpha = s + t - s * t;
        float beta = alpha > 0.0 ? s / alpha : 0.0;
        vec3 blue = vec3(0.0, 0.0, 1.0);
        vec3 color = beta * fadeColor + (1.0 - beta) * blue;

        gl_FragColor = vec4(color, alpha);
    }

    |]


fragmentShaderConstant : WebGL.Shader {} Uniforms Varyings
fragmentShaderConstant =
    [glsl|

    precision mediump float;
    uniform vec3 fragmentColor;
    varying vec3 vpos;
    varying vec3 vnormal;

    void main () {
        gl_FragColor = vec4(fragmentColor, 1.0);
    }

    |]
