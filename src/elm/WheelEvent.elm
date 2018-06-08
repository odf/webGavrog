module WheelEvent exposing (onMouseWheel)

import Html
import Html.Events
import Json.Decode as Json


onMouseWheel : (Float -> msg) -> Html.Attribute msg
onMouseWheel tagger =
    let
        options =
            { stopPropagation = True, preventDefault = True }

        decoder =
            Json.at [ "deltaY" ] Json.float
    in
        Html.Events.onWithOptions "wheel" options (Json.map tagger decoder)
