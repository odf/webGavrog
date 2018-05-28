port module Options exposing (main)

import Html exposing (..)
import Html.Attributes exposing (..)
import Html.Events exposing (onClick)


main =
    Html.programWithFlags
        { init = init
        , view = view
        , subscriptions = subscriptions
        , update = update
        }



-- MODEL


type alias Model =
    { colorByTranslationClass : Bool
    , skipRelaxation : Bool
    , extraSmooth : Bool
    , showSurfaceMesh : Bool
    , highlightPicked : Bool
    }


type alias Flags =
    Model


init : Flags -> ( Model, Cmd Msg )
init flags =
    flags ! []



-- UPDATE


port send : ( Model, Bool ) -> Cmd msg


type Msg
    = ToggleColorByTranslations
    | ToggleSkipRelaxation
    | ToggleExtraSmooth
    | ToggleShowSurfaceMesh
    | ToggleHighlightPicked
    | Send
    | Cancel


update : Msg -> Model -> ( Model, Cmd Msg )
update msg model =
    case msg of
        ToggleColorByTranslations ->
            { model
                | colorByTranslationClass = not model.colorByTranslationClass
            }
                ! []

        ToggleSkipRelaxation ->
            { model
                | skipRelaxation = not model.skipRelaxation
            }
                ! []

        ToggleExtraSmooth ->
            { model
                | extraSmooth = not model.extraSmooth
            }
                ! []

        ToggleShowSurfaceMesh ->
            { model
                | showSurfaceMesh = not model.showSurfaceMesh
            }
                ! []

        ToggleHighlightPicked ->
            { model
                | highlightPicked = not model.highlightPicked
            }
                ! []

        Send ->
            ( model, send ( model, True ) )

        Cancel ->
            ( model, send ( model, False ) )



-- VIEW


view : Model -> Html Msg
view model =
    fieldset [ class "form-section" ]
        [ checkbox
            ToggleColorByTranslations
            "Color By Translations"
            model.colorByTranslationClass
        , checkbox
            ToggleSkipRelaxation
            "Skip Relaxation"
            model.skipRelaxation
        , checkbox
            ToggleExtraSmooth
            "Extra-Smooth Faces"
            model.extraSmooth
        , checkbox
            ToggleShowSurfaceMesh
            "Show Surface Mesh"
            model.showSurfaceMesh
        , checkbox
            ToggleHighlightPicked
            "Highlight On Mouseover"
            model.highlightPicked
        , p [ class "form-buttons" ]
            [ button [ onClick Send ] [ text "OK" ]
            , button [ onClick Cancel ] [ text "Cancel" ]
            ]
        ]


checkbox : msg -> String -> Bool -> Html msg
checkbox msg name isOn =
    div [ class "form-element" ]
        [ label [] [ text name ]
        , input [ type_ "checkbox", checked isOn, onClick msg ] []
        ]



-- SUBSCRIPTIONS


subscriptions : Model -> Sub Msg
subscriptions model =
    Sub.batch []
