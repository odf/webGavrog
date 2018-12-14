module View3d.Renderer exposing (Material, Scene, Vertex, entities)

import Math.Matrix4 as Mat4 exposing (Mat4)
import Math.Vector3 as Vec3 exposing (Vec3, vec3)
import WebGL


type alias Vertex =
    { pos : Vec3
    , normal : Vec3
    }


type alias Material =
    { ambientColor : Vec3
    , diffuseColor : Vec3
    , specularColor : Vec3
    , ka : Float
    , kd : Float
    , ks : Float
    , shininess : Float
    }


type alias Scene =
    List
        { mesh : WebGL.Mesh Vertex
        , material : Material
        , transform : Mat4
        }


type alias Uniforms =
    { transform : Mat4
    , viewing : Mat4
    , perspective : Mat4
    , cameraPos : Vec3
    , light1Pos : Vec3
    , light1Color : Vec3
    , light2Pos : Vec3
    , light2Color : Vec3
    , light3Pos : Vec3
    , light3Color : Vec3
    , ambientColor : Vec3
    , diffuseColor : Vec3
    , specularColor : Vec3
    , ka : Float
    , kd : Float
    , ks : Float
    , shininess : Float
    }


type alias Varyings =
    { vpos : Vec3
    , vnormal : Vec3
    }


entities : Scene -> Float -> Mat4 -> Mat4 -> List WebGL.Entity
entities scene camDist viewingMatrix perspectiveMatrix =
    let
        black =
            vec3 0 0 0

        baseUniforms =
            { transform = Mat4.identity
            , viewing = viewingMatrix
            , perspective = perspectiveMatrix
            , cameraPos = vec3 0 0 camDist
            , light1Pos = vec3 2 1 2 |> Vec3.scale (camDist / 2)
            , light1Color = vec3 1 1 1 |> Vec3.scale (2 / 3)
            , light2Pos = vec3 -2 -1 4 |> Vec3.scale (camDist / 4)
            , light2Color = vec3 1 1 1 |> Vec3.scale (1 / 3)
            , light3Pos = vec3 1 1 -4 |> Vec3.scale (camDist / 4)
            , light3Color = vec3 0 0 1 |> Vec3.scale (1 / 5)
            , ambientColor = black
            , diffuseColor = black
            , specularColor = black
            , ka = 0
            , kd = 0
            , ks = 0
            , shininess = 0
            }
    in
    List.map
        (\{ mesh, material, transform } ->
            let
                uniforms =
                    { baseUniforms
                        | transform = transform
                        , ambientColor = material.ambientColor
                        , diffuseColor = material.diffuseColor
                        , specularColor = material.specularColor
                        , ka = material.ka
                        , kd = material.kd
                        , ks = material.ks
                        , shininess = material.shininess
                    }
            in
            WebGL.entity vertexShader fragmentShader mesh uniforms
        )
        scene


vertexShader : WebGL.Shader Vertex Uniforms Varyings
vertexShader =
    [glsl|

    attribute vec3 pos;
    attribute vec3 normal;
    uniform mat4 transform;
    uniform mat4 viewing;
    uniform mat4 perspective;
    varying vec3 vpos;
    varying vec3 vnormal;

    void main () {
        vpos = (viewing * transform * vec4(pos, 1.0)).xyz;
        vnormal = (viewing * transform * vec4(normal, 0.0)).xyz;
        gl_Position = perspective * viewing * transform * vec4(pos, 1.0);
    }

    |]


fragmentShader : WebGL.Shader {} Uniforms Varyings
fragmentShader =
    [glsl|

    precision mediump float;
    uniform vec3 cameraPos;
    uniform vec3 light1Pos;
    uniform vec3 light1Color;
    uniform vec3 light2Pos;
    uniform vec3 light2Color;
    uniform vec3 light3Pos;
    uniform vec3 light3Color;
    uniform vec3 ambientColor;
    uniform vec3 diffuseColor;
    uniform vec3 specularColor;
    uniform float ka;
    uniform float kd;
    uniform float ks;
    uniform float shininess;
    varying vec3 vpos;
    varying vec3 vnormal;

    vec3 colorFromLight (vec3 lightPos, vec3 lightColor) {
        vec3 normVec = normalize(vnormal);
        vec3 lightVec = normalize(lightPos - vpos);

        float diffuse = max(dot(normVec, lightVec), 0.0);

        float specular = 0.0;

        if(diffuse > 0.0) {
          vec3 reflectVec = reflect(-lightVec, normVec);
          vec3 camVec = normalize(cameraPos - vpos);
          float t = max(dot(reflectVec, camVec), 0.0);
          specular = pow(t, shininess);
        }

        vec3 cd = kd * diffuse * diffuseColor;
        vec3 cs = ks * specular * specularColor;
        vec3 ca = ka * ambientColor;

        return ca + lightColor * (cd + cs);
    }

    void main () {
        vec3 color = ka * ambientColor;
        color += colorFromLight(light1Pos, light1Color);
        color += colorFromLight(light2Pos, light2Color);
        color += colorFromLight(light3Pos, light3Color);

        gl_FragColor = vec4(color, 1.0);
    }

    |]
