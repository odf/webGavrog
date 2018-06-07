port module ElmMenu exposing (main)

import Html exposing (..)
import Html.Attributes exposing (..)
import Html.Events exposing (onClick, onMouseEnter, onMouseLeave)


main =
    Html.programWithFlags
        { init = init
        , update = update
        , view = view
        , subscriptions = \_ -> Sub.none
        }



-- MODEL


type alias ItemSpec =
    { label : String
    , submenu : Maybe (List String)
    }


type alias Classes =
    { menu : String
    , item : String
    , submenu : String
    , subitem : String
    , highlight : String
    }


type alias Flags =
    { classes : Classes
    , items : List ItemSpec
    }


type alias Model =
    { classes : Classes
    , items : List ItemSpec
    , active : Maybe Int
    , activeSub : Maybe Int
    }


init : Flags -> ( Model, Cmd Msg )
init flags =
    { classes = flags.classes
    , items = flags.items
    , active = Nothing
    , activeSub = Nothing
    }
        ! []



-- UPDATE


port send : ( Maybe Int, Maybe Int ) -> Cmd msg


type Msg
    = Activate (Maybe Int)
    | ActivateSub (Maybe Int)
    | Select


update : Msg -> Model -> ( Model, Cmd Msg )
update msg model =
    case msg of
        Activate i ->
            { model | active = i } ! []

        ActivateSub i ->
            { model | activeSub = i } ! []

        Select ->
            ( { model | active = Nothing, activeSub = Nothing }
            , send ( model.active, model.activeSub )
            )



-- VIEW


view : Model -> Html Msg
view model =
    ul
        [ class model.classes.menu ]
        (List.indexedMap (viewItem model) model.items)


viewItem : Model -> Int -> ItemSpec -> Html Msg
viewItem model index item =
    let
        isActive =
            model.active == Just index

        maybeSubMenu =
            case item.submenu of
                Nothing ->
                    []

                Just sub ->
                    if isActive then
                        [ viewSubMenu model sub ]
                    else
                        []
    in
        li
            [ classList
                [ ( model.classes.item, True )
                , ( model.classes.highlight, isActive )
                ]
            , onMouseEnter <| Activate (Just index)
            , onMouseLeave <| Activate Nothing
            , onClick Select
            ]
            ([ text item.label ] ++ maybeSubMenu)


viewSubMenu : Model -> List String -> Html Msg
viewSubMenu model labels =
    ul
        [ class model.classes.submenu ]
        (List.indexedMap (viewSubItem model) labels)


viewSubItem : Model -> Int -> String -> Html Msg
viewSubItem model index label =
    li
        [ classList
            [ ( model.classes.subitem, True )
            , ( model.classes.highlight, model.activeSub == Just index )
            ]
        , onMouseEnter <| ActivateSub (Just index)
        , onMouseLeave <| ActivateSub Nothing
        , onClick Select
        ]
        [ text label ]
